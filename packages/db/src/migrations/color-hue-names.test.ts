import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type postgres from 'postgres';
import { createDbClient } from '../client';
import { HUES, LIVE_COLORS, SEED_COLORS, type StoredColor } from './color-hue-names.fixture';

// Migration 0008 (TK-5.21.1) turns each stored hex config.color into the hue
// name it was shown as. tickets_test is already migrated, so each case writes
// its own rows, runs the migration's statements over them again, reads them
// back, and rolls everything back.
const MIGRATION = readFileSync(
  resolve(import.meta.dirname, '../../drizzle/0008_color_hue_names.sql'),
  'utf8',
)
  .split('--> statement-breakpoint')
  .map((statement) => statement.trim())
  .filter(Boolean);

class Rollback extends Error {}

// Writes each color on an option and on a type of a scheme of its own, runs
// the migration, and returns what each option's and type's config became.
async function migrate(
  sql: postgres.Sql,
  configs: Record<string, unknown>[],
): Promise<{ options: Record<string, unknown>[]; types: Record<string, unknown>[] }> {
  let result: { options: Record<string, unknown>[]; types: Record<string, unknown>[] } | undefined;
  await sql
    .begin(async (tx) => {
      const [scheme] = await tx`
        INSERT INTO structure.schemes (key, name) VALUES ('migration-0008', 'Migration 0008') RETURNING id`;
      const [set] = await tx`
        INSERT INTO structure.option_sets (scheme_id, key, name) VALUES (${scheme!.id}, 'colors', 'Colors') RETURNING id`;
      for (const [position, config] of configs.entries()) {
        await tx`
          INSERT INTO structure.options (option_set_id, value, label, position, config)
          VALUES (${set!.id}, ${`o${position}`}, ${`O${position}`}, ${position}, ${JSON.stringify(config)}::jsonb)`;
        await tx`
          INSERT INTO structure.item_types (scheme_id, key, label, position, config)
          VALUES (${scheme!.id}, ${`t${position}`}, ${`T${position}`}, ${position}, ${JSON.stringify(config)}::jsonb)`;
      }
      for (const statement of MIGRATION) {
        await tx.unsafe(statement);
      }
      const options = await tx`
        SELECT config FROM structure.options WHERE option_set_id = ${set!.id} ORDER BY position`;
      const types = await tx`
        SELECT config FROM structure.item_types WHERE scheme_id = ${scheme!.id} ORDER BY position`;
      result = {
        options: options.map((row) => row.config as Record<string, unknown>),
        types: types.map((row) => row.config as Record<string, unknown>),
      };
      throw new Rollback();
    })
    .catch((error: unknown) => {
      if (!(error instanceof Rollback)) {
        throw error;
      }
    });
  return result!;
}

describe('migration 0008: config.color holds a hue name (runs against tickets_test)', () => {
  let sql: postgres.Sql;

  beforeAll(() => {
    ({ sql } = createDbClient({ max: 1 }));
  });
  afterAll(async () => {
    await sql.end();
  });

  const cases: [string, StoredColor[]][] = [
    ['the seed', SEED_COLORS],
    ['the live database', LIVE_COLORS],
  ];
  it.each(cases)('turns every hex %s stored into the hue it was shown as', async (_, colors) => {
    const { options, types } = await migrate(
      sql,
      colors.map(({ hex }) => ({ color: hex })),
    );
    const expected = colors.map(({ hex, hue }) => ({ hex, hue }));
    expect(options.map((config, i) => ({ hex: colors[i]!.hex, hue: config.color }))).toEqual(
      expected,
    );
    expect(types.map((config, i) => ({ hex: colors[i]!.hex, hue: config.color }))).toEqual(
      expected,
    );
  });

  it('leaves a hue name as it is, so a second run changes nothing', async () => {
    const { options, types } = await migrate(
      sql,
      HUES.map((hue) => ({ color: hue })),
    );
    expect(options.map((config) => config.color)).toEqual([...HUES]);
    expect(types.map((config) => config.color)).toEqual([...HUES]);
  });

  it('turns what is no six-digit hex into gray, as it was shown', async () => {
    const { options } = await migrate(sql, [
      { color: '#888' },
      { color: 'rebeccapurple' },
      { color: '' },
      { color: ' #D03B3B ' },
      { color: 'd03b3b' },
    ]);
    expect(options.map((config) => config.color)).toEqual(['gray', 'gray', 'gray', 'red', 'red']);
  });

  it('keeps the rest of the config, and a config without a color', async () => {
    const { options, types } = await migrate(sql, [
      { color: '#3987e5', icon: 'bug', initial: true },
      { initial: true },
      {},
      { color: null },
    ]);
    const expected = [
      { color: 'blue', icon: 'bug', initial: true },
      { initial: true },
      {},
      { color: null },
    ];
    expect(options).toEqual(expected);
    expect(types).toEqual(expected);
  });
});
