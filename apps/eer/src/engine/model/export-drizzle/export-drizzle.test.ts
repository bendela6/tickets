// Node-only (see vitest.config.ts's environmentMatchGlobs): the gate test
// (Step 5 of task-6-brief.md) writes generated source to a temp file via
// loadGeneratedModule and hands it to drizzle-kit/api, which touches the
// filesystem. The pure exportDrizzle unit tests above it don't need that, but
// live in the same file (and so the same environment) per the brief.
import { generateDrizzleJson, generateMigration } from 'drizzle-kit/api';
import { describe, expect, it } from 'vitest';

import { generatedConstraintName } from '../../../components/editor/generated-constraint-name';
import { loadGeneratedModule } from '../../../test/helpers/load-generated-module';
import { importDrizzle } from '../import-drizzle';
import { loadModel } from '../load-model';
import type { Model } from '../types';

import { describeDrizzle } from '../../../node/describe-drizzle';

import { exportDrizzle } from './export-drizzle';

// ---- fixture helper: raw JSON -> Model, reusing loadModel's normalisation ----
function buildRawModel(entities: any[], enums: any[] = []): Model {
  const raw = {
    groups: [{ id: 'g', label: 'G', order: 0 }],
    entities: entities.map((e) => ({ group: 'g', ...e })),
    enums,
  };
  const { model, errors } = loadModel(raw);
  if (!model || errors.length) throw new Error(`fixture model invalid: ${errors.join('; ')}`);
  return model;
}

function pkCol(name = 'id', type = 'serial') {
  return { name, type };
}

describe('exportDrizzle — pure unit tests', () => {
  it('emits pgEnum declarations before any pgTable', () => {
    const m = buildRawModel(
      [
        {
          id: 'users',
          columns: [pkCol(), { name: 'role', type: 'user_role' }],
          constraints: [{ id: 'c1', kind: 'pk', name: null, columns: ['id'] }],
        },
      ],
      [{ name: 'user_role', values: ['admin', 'member'], schema: null }],
    );
    const src = exportDrizzle(m);
    expect(src).toContain(`pgEnum('user_role', ['admin', 'member'])`);
    expect(src.indexOf('pgEnum(')).toBeLessThan(src.indexOf('pgTable('));
    expect(src).toContain(`role: userRoleEnum('role')`);
  });

  it('emits a serial primary key, notNull, and a sql default verbatim', () => {
    const m = buildRawModel([
      {
        id: 'users',
        columns: [pkCol(), { name: 'email', type: 'text', nullable: false }, { name: 'hits', type: 'integer', default: '0' }],
        constraints: [{ id: 'c1', kind: 'pk', name: null, columns: ['id'] }],
      },
    ]);
    const src = exportDrizzle(m);
    // A single-column, unnamed pk is inline (see the dedicated pk-shape tests
    // below) — never a table-level primaryKey({...}) construct.
    expect(src).toContain(`id: serial('id').primaryKey(),`);
    expect(src).toContain(`email: text('email').notNull(),`);
    expect(src).toContain(`hits: integer('hits').default(sql\`0\`),`);
    expect(src).not.toContain('primaryKey({');
  });

  describe('primary key shape (Finding 1: inline vs. table-level)', () => {
    it('emits an inline .primaryKey() for a single-column, unnamed pk', () => {
      const m = buildRawModel([
        {
          id: 'users',
          columns: [pkCol()],
          constraints: [{ id: 'c1', kind: 'pk', name: null, columns: ['id'] }],
        },
      ]);
      const src = exportDrizzle(m);
      expect(src).toContain(`id: serial('id').primaryKey(),`);
      // No table-level construct at all — there's nothing else on this table.
      expect(src).not.toMatch(/\(t\) =>/);
      expect(src).not.toContain('primaryKey({');
    });

    it('emits a table-level primaryKey({ name, columns }) for a single-column pk that HAS a captured name', () => {
      const m = buildRawModel([
        {
          id: 'users',
          columns: [pkCol()],
          constraints: [{ id: 'c1', kind: 'pk', name: 'users_id_pk', columns: ['id'] }],
        },
      ]);
      const src = exportDrizzle(m);
      expect(src).toContain(`id: serial('id'),`);
      expect(src).not.toContain('.primaryKey()');
      expect(src).toContain(`primaryKey({ name: 'users_id_pk', columns: [t.id] })`);
    });

    it('emits a table-level primaryKey({ columns }) for a composite (multi-column) pk, even when unnamed', () => {
      const m = buildRawModel([
        {
          id: 'memberships',
          columns: [pkCol(), { name: 'seq', type: 'integer' }],
          constraints: [{ id: 'c1', kind: 'pk', name: null, columns: ['id', 'seq'] }],
        },
      ]);
      const src = exportDrizzle(m);
      expect(src).toContain(`id: serial('id'),`);
      expect(src).not.toContain('.primaryKey()');
      expect(src).toContain(`primaryKey({ columns: [t.id, t.seq] })`);
    });
  });

  describe('boolean default shape (Finding 2: bare literal vs. sql`...`)', () => {
    it('emits a bare .default(true)/.default(false) for a boolean column, never sql`...`', () => {
      const m = buildRawModel([
        {
          id: 'fields',
          columns: [
            pkCol(),
            { name: 'required', type: 'boolean', nullable: false, default: 'true' },
            { name: 'system', type: 'boolean', nullable: false, default: 'false' },
          ],
        },
      ]);
      const src = exportDrizzle(m);
      expect(src).toContain(`required: boolean('required').notNull().default(true),`);
      expect(src).toContain(`system: boolean('system').notNull().default(false),`);
      expect(src).not.toContain('sql`true`');
      expect(src).not.toContain('sql`false`');
    });

    it('still emits a non-boolean default of the text "true" through sql`...` (no cross-type guessing)', () => {
      const m = buildRawModel([
        { id: 'notes', columns: [pkCol(), { name: 'label', type: 'text', nullable: false, default: 'true' }] },
      ]);
      const src = exportDrizzle(m);
      expect(src).toContain(`label: text('label').notNull().default(sql\`true\`),`);
    });
  });

  it('emits array dimensions per the model, sized and nested', () => {
    const m = buildRawModel([
      {
        id: 'widgets',
        columns: [pkCol(), { name: 'tags', type: 'text[]' }, { name: 'grid', type: 'integer[2][]' }],
        constraints: [{ id: 'c1', kind: 'pk', name: null, columns: ['id'] }],
      },
    ]);
    const src = exportDrizzle(m);
    expect(src).toContain(`tags: text('tags').array(),`);
    expect(src).toContain(`grid: integer('grid').array(2).array(),`);
  });

  it('emits timestamp/date columns with mode: "string" and the tz variant as an option, not a separate builder', () => {
    const m = buildRawModel([
      {
        id: 'events',
        columns: [
          pkCol(),
          { name: 'created_at', type: 'timestamp with time zone' },
          { name: 'happens_on', type: 'date' },
          { name: 'starts_at', type: 'time(3)' },
        ],
        constraints: [{ id: 'c1', kind: 'pk', name: null, columns: ['id'] }],
      },
    ]);
    const src = exportDrizzle(m);
    expect(src).toContain(`createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }),`);
    expect(src).toContain(`happensOn: date('happens_on', { mode: 'string' }),`);
    expect(src).toContain(`startsAt: time('starts_at', { precision: 3 }),`);
    // Only one `timestamp`/`time` import — the tz spelling never introduces a second builder.
    expect(src.match(/\btimestamp\b/g)!.length).toBeGreaterThan(0);
    expect(src).not.toMatch(/timestamptz|timetz/);
  });

  it('emits a numeric precision/scale and a bigint/bigserial mode (required at runtime, invisible to SQL)', () => {
    const m = buildRawModel([
      {
        id: 'accounts',
        columns: [
          { name: 'id', type: 'bigserial' },
          { name: 'balance', type: 'numeric(12,2)' },
          { name: 'external_id', type: 'bigint' },
        ],
        constraints: [{ id: 'c1', kind: 'pk', name: null, columns: ['id'] }],
      },
    ]);
    const src = exportDrizzle(m);
    expect(src).toContain(`id: bigserial('id', { mode: 'number' })`);
    expect(src).toContain(`balance: numeric('balance', { precision: 12, scale: 2 }),`);
    expect(src).toContain(`externalId: bigint('external_id', { mode: 'number' }),`);
  });

  it('emits a check constraint and a table-level unique with nullsNotDistinct, names verbatim', () => {
    const m = buildRawModel([
      {
        id: 'transitions',
        columns: [pkCol(), { name: 'from_id', type: 'integer' }, { name: 'to_id', type: 'integer' }],
        constraints: [
          { id: 'c1', kind: 'pk', name: null, columns: ['id'] },
          { id: 'c2', kind: 'unique', name: 'transitions_edge', columns: ['from_id', 'to_id'], nullsNotDistinct: true },
          { id: 'c3', kind: 'check', name: 'transitions_not_self', expression: 'from_id <> to_id' },
        ],
      },
    ]);
    const src = exportDrizzle(m);
    expect(src).toContain(`unique('transitions_edge').on(t.fromId, t.toId).nullsNotDistinct(),`);
    expect(src).toContain(`check('transitions_not_self', sql\`from_id <> to_id\`),`);
  });

  it('throws if a check constraint has no name (drizzle requires one)', () => {
    const m = buildRawModel([
      {
        id: 't',
        columns: [pkCol()],
        constraints: [
          { id: 'c1', kind: 'pk', name: null, columns: ['id'] },
          { id: 'c2', kind: 'check', name: null, expression: 'id > 0' },
        ],
      },
    ]);
    expect(() => exportDrizzle(m)).toThrow(/check constraint on "t" has no name/);
  });

  it('emits a composite fk with onDelete/onUpdate actions and the captured name verbatim', () => {
    const m = buildRawModel([
      {
        id: 'accounts',
        columns: [pkCol(), { name: 'slug', type: 'text' }, { name: 'region', type: 'text' }],
        constraints: [{ id: 'c1', kind: 'pk', name: null, columns: ['id'] }],
      },
      {
        id: 'memberships',
        columns: [pkCol(), { name: 'account_slug', type: 'text' }, { name: 'account_region', type: 'text' }],
        constraints: [
          { id: 'c1', kind: 'pk', name: null, columns: ['id'] },
          {
            id: 'c2',
            kind: 'fk',
            name: 'memberships_account_fk',
            columns: ['account_slug', 'account_region'],
            refSchema: null,
            refTable: 'accounts',
            refColumns: ['slug', 'region'],
            onDelete: 'cascade',
            onUpdate: 'restrict',
          },
        ],
      },
    ]);
    const src = exportDrizzle(m);
    expect(src).toContain(
      `foreignKey({ name: 'memberships_account_fk', columns: [t.accountSlug, t.accountRegion], foreignColumns: [accounts.slug, accounts.region] }).onDelete('cascade').onUpdate('restrict'),`,
    );
  });

  it('throws if an fk constraint references a table not in the model', () => {
    const m = buildRawModel([
      {
        id: 'memberships',
        columns: [pkCol()],
        constraints: [
          { id: 'c1', kind: 'pk', name: null, columns: ['id'] },
          { id: 'c2', kind: 'fk', name: 'fk1', columns: ['id'], refSchema: null, refTable: 'ghosts', refColumns: ['id'], onDelete: null, onUpdate: null },
        ],
      },
    ]);
    expect(() => exportDrizzle(m)).toThrow(/references unknown table "ghosts"/);
  });

  it('emits indexes with method/only/where and per-column asc/desc/nullsFirst/nullsLast/op, an expression column, verbatim names', () => {
    const m = buildRawModel([
      {
        id: 'widgets',
        columns: [pkCol(), { name: 'name', type: 'text' }, { name: 'category', type: 'text' }],
        constraints: [{ id: 'c1', kind: 'pk', name: null, columns: ['id'] }],
        indexes: [
          {
            id: 'i1',
            name: 'widgets_name_idx',
            unique: false,
            method: 'hash',
            only: false,
            where: `category = 'x'`,
            columns: [{ expression: 'name', isExpression: false, order: 'desc', nulls: 'first', opClass: 'text_ops' }],
          },
          {
            id: 'i2',
            name: 'widgets_only_idx',
            unique: true,
            method: null,
            only: true,
            where: null,
            columns: [{ expression: 'category', isExpression: false, order: null, nulls: null, opClass: null }],
          },
          {
            id: 'i3',
            name: 'widgets_lower_name_idx',
            unique: false,
            method: null,
            only: false,
            where: null,
            columns: [{ expression: 'lower(name)', isExpression: true, order: null, nulls: null, opClass: null }],
          },
        ],
      },
    ]);
    const src = exportDrizzle(m);
    expect(src).toContain(
      `index('widgets_name_idx').using('hash', t.name.desc().nullsFirst().op('text_ops')).where(sql\`category = 'x'\`),`,
    );
    expect(src).toContain(`uniqueIndex('widgets_only_idx').onOnly(t.category),`);
    expect(src).toContain(`index('widgets_lower_name_idx').on(sql\`lower(name)\`),`);
  });

  it('emits identity and a generated stored column', () => {
    const m = buildRawModel([
      {
        id: 'seqs',
        columns: [
          {
            name: 'id',
            type: 'integer',
            identity: {
              always: true,
              name: 'seqs_id_seq',
              increment: '1',
              minValue: '1',
              maxValue: '1000',
              startWith: '1',
              cache: '1',
              cycle: false,
            },
          },
          { name: 'first', type: 'text' },
          { name: 'last', type: 'text' },
          { name: 'full_name', type: 'text', generated: { expression: "first || ' ' || last", stored: true } },
        ],
        constraints: [{ id: 'c1', kind: 'pk', name: null, columns: ['id'] }],
      },
    ]);
    const src = exportDrizzle(m);
    // 'id' is also this table's sole, unnamed pk column -> inline .primaryKey(),
    // ahead of the identity chain (the common drizzle idiom:
    // `.primaryKey().generatedAlwaysAsIdentity()`).
    expect(src).toContain(
      `id: integer('id').primaryKey().generatedAlwaysAsIdentity({ name: 'seqs_id_seq', increment: 1, minValue: 1, maxValue: 1000, startWith: 1, cache: 1, cycle: false }),`,
    );
    expect(src).toContain(`fullName: text('full_name').generatedAlwaysAs(sql\`first || ' ' || last\`),`);
  });

  it('throws rather than exporting a model with an unknown type', () => {
    const m = buildRawModel([{ id: 'orders', columns: [pkCol(), { name: 'amount', type: 'legacy_money' }] }]);
    expect(() => exportDrizzle(m)).toThrow(/legacy_money/);
  });

  it('escapes a default containing a backtick or a template hole', () => {
    const m = buildRawModel([
      {
        id: 'x',
        columns: [pkCol(), { name: 'note', type: 'text', default: "concat('`', ${'$'}{x})" }],
      },
    ]);
    const src = exportDrizzle(m);
    expect(src).toContain('\\`');
    expect(src).toContain('\\${');
  });

  it('schema-qualifies a table and enum via pgSchema(...).table/.enum', () => {
    const m = buildRawModel(
      [
        {
          id: 'analytics.events',
          schema: 'analytics',
          columns: [pkCol(), { name: 'kind', type: 'event_kind' }],
          constraints: [{ id: 'c1', kind: 'pk', name: null, columns: ['id'] }],
        },
      ],
      [{ name: 'event_kind', values: ['click', 'view'], schema: 'analytics' }],
    );
    const src = exportDrizzle(m);
    expect(src).toContain(`export const analyticsSchema = pgSchema('analytics');`);
    expect(src).toContain(`analyticsSchema.enum('event_kind'`);
    expect(src).toContain(`analyticsSchema.table('events'`);
  });
});

describe('exportDrizzle — semantic verification via a real drizzle module', () => {
  it('a generated file with identity/generated/composite-fk/partial-index round-trips through describeDrizzle unchanged', async () => {
    const m = buildRawModel([
      {
        id: 'accounts',
        columns: [pkCol(), { name: 'slug', type: 'text' }, { name: 'region', type: 'text' }],
        constraints: [
          { id: 'c1', kind: 'pk', name: null, columns: ['id'] },
          { id: 'c2', kind: 'unique', name: 'accounts_slug_region_key', columns: ['slug', 'region'], nullsNotDistinct: false },
        ],
      },
      {
        id: 'memberships',
        columns: [
          pkCol(),
          { name: 'account_slug', type: 'text' },
          { name: 'account_region', type: 'text' },
          { name: 'is_active', type: 'boolean', default: 'true' },
        ],
        constraints: [
          { id: 'c1', kind: 'pk', name: null, columns: ['id'] },
          {
            id: 'c2',
            kind: 'fk',
            name: 'memberships_account_fk',
            columns: ['account_slug', 'account_region'],
            refSchema: null,
            refTable: 'accounts',
            refColumns: ['slug', 'region'],
            onDelete: 'cascade',
            onUpdate: null,
          },
        ],
        indexes: [
          {
            id: 'i1',
            name: 'memberships_active_account_idx',
            unique: true,
            method: null,
            only: false,
            where: 'is_active',
            columns: [
              { expression: 'account_slug', isExpression: false, order: null, nulls: null, opClass: null },
              { expression: 'account_region', isExpression: false, order: null, nulls: null, opClass: null },
            ],
          },
        ],
      },
    ]);

    const src = exportDrizzle(m);
    const generated = await loadGeneratedModule(src);
    const desc = describeDrizzle(generated, []);

    const accounts = desc.tables.find((t) => t.name === 'accounts')!;
    expect(accounts.uniques).toEqual([{ name: 'accounts_slug_region_key', columns: ['slug', 'region'], nullsNotDistinct: false }]);

    const memberships = desc.tables.find((t) => t.name === 'memberships')!;
    expect(memberships.foreignKeys[0]).toMatchObject({
      name: 'memberships_account_fk',
      columns: ['account_slug', 'account_region'],
      refTable: 'accounts',
      refColumns: ['slug', 'region'],
      onDelete: 'cascade',
    });
    expect(memberships.indexes[0]).toMatchObject({
      name: 'memberships_active_account_idx',
      unique: true,
      where: 'is_active',
    });
  });

  // Task 12 review, Finding 1 (IMPORTANT): generatedConstraintName's greyed
  // placeholder (constraints-editor.tsx) is used with the raw Entity.id,
  // which is SCHEMA-QUALIFIED for a non-public table (e.g. "billing.orders")
  // — but drizzle names an unnamed constraint off the PHYSICAL table name
  // only (pgTable's first argument, stripped of the schema prefix — see
  // export-drizzle.ts's own physicalTableName()). So the card used to show
  // "billing.orders_number_unique" while the real drizzle object (and the
  // exporter's own generated source, once loaded and run) is actually named
  // "orders_number_unique". Proved here against the REAL computed name (via
  // loadGeneratedModule + describeDrizzle), not just the generated source
  // text — table-level unique names are never printed in the emitted DDL at
  // all (drizzle computes them at schema-definition time), so only running
  // the real module can reveal what name a blank one actually gets.
  it('the placeholder for an unnamed constraint on a schema-qualified table equals what exportDrizzle (+ real drizzle) actually assigns', async () => {
    const m = buildRawModel([
      {
        id: 'billing.orders',
        schema: 'billing',
        columns: [pkCol(), { name: 'number', type: 'text' }],
        constraints: [
          { id: 'c1', kind: 'pk', name: null, columns: ['id'] },
          { id: 'c2', kind: 'unique', name: null, columns: ['number'], nullsNotDistinct: false },
        ],
      },
    ]);
    const entity = m.entityById.get('billing.orders')!;
    const uniqueConstraint = entity.constraints.find((c) => c.kind === 'unique')!;

    const preview = generatedConstraintName(entity, uniqueConstraint, entity.constraints);

    const src = exportDrizzle(m);
    const generated = await loadGeneratedModule(src);
    const desc = describeDrizzle(generated, []);
    const table = desc.tables.find((t) => t.name === 'orders')!;

    expect(preview).toBe(table.uniques[0]!.name);
  });
});

describe('exportDrizzle — the two-table gate (Step 5)', () => {
  it('round-trips a two-table schema through drizzle-kit with an empty migration', async () => {
    const original = await import('../../../test/fixtures/tiny-schema');
    const { model } = importDrizzle(describeDrizzle(original as unknown as Record<string, unknown>, []), null);

    const src = exportDrizzle(model);
    const regenerated = await loadGeneratedModule(src);

    const before = await generateDrizzleJson(original as unknown as Record<string, unknown>);
    const after = await generateDrizzleJson(regenerated);
    const migration = await generateMigration(before, after);

    expect(migration).toEqual([]); // Postgres cannot tell the two schemas apart
  });
});
