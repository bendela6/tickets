import { describe, expect, it } from 'vitest';
import { withDatabase } from './connect';
import { readEnums } from './read-enums';

describe('readEnums', () => {
  it('reads enum declarations with ordered values', async () => {
    const enums = await withDatabase('tickets_test', (sql) => readEnums(sql));
    expect(enums.length).toBeGreaterThan(0);
    for (const e of enums) {
      expect(e.name.length).toBeGreaterThan(0);
      expect(e.values.length).toBeGreaterThan(0);
    }
  });

  it('reads every enum once, qualified by its schema', async () => {
    const enums = await withDatabase('tickets_test', (sql) => readEnums(sql));
    expect(enums.map((e) => `${e.schema}.${e.name}`).sort()).toEqual([
      'core.user_kind',
      'structure.field_type',
      'structure.status_kind',
    ]);
  });

  it('carries the real namespace, never the string "public"', async () => {
    const enums = await withDatabase('tickets_test', (sql) => readEnums(sql));
    expect(enums.find((e) => e.name === 'field_type')!.schema).toBe('structure');
    for (const e of enums) expect(e.schema).not.toBe('public');
  });

  it('keeps enum values in declaration order, not alphabetical', async () => {
    // structure.status_kind's declared order (todo, active, blocked, done,
    // dropped) is a status ladder — its meaning. Alphabetical order would be
    // (active, blocked, done, dropped, todo): every element moves, so an
    // `ORDER BY enumlabel` regression can't hide behind a partial match.
    const enums = await withDatabase('tickets_test', (sql) => readEnums(sql));
    const statusKind = enums.find((e) => e.name === 'status_kind' && e.schema === 'structure');
    expect(statusKind?.values).toEqual(['todo', 'active', 'blocked', 'done', 'dropped']);
  });
});
