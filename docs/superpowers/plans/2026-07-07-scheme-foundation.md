# Scheme Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a reusable **Scheme** entity that owns ticket structure (types + type-owned statuses + fields + link types), re-scope the config tables from project → scheme, and rewrite the seed to produce one shared "Software" scheme plus projects bound to it.

**Architecture:** A new `schemes` table becomes the owner of `ticket_types`, `fields`, and `link_types`; `statuses` become owned by their `ticket_type`. Projects gain `scheme_id` and bind to a scheme. New FK columns are added **nullable** and the old `project_id` columns are **kept** during this plan so nothing breaks — Plan 3 (Migration) backfills, remaps existing tickets, then drops the old columns. The seed is split into pure data (`software-scheme.ts`), a scheme seeder (`seed-scheme.ts`), and a project seeder that binds to a scheme.

**Tech Stack:** Drizzle ORM 0.45 + drizzle-kit 0.31 (postgres-js), TypeScript, tsx, pnpm + turbo. Fastify API (valibot). No transitions/guards/hierarchy or clone in this plan — those are Plan 2.

## Global Constraints

- **Postgres must be running:** `docker compose up -d` (api DB on :4600). Every migrate/seed step needs it.
- **Migrations are generated, never hand-written:** edit schema files, then `pnpm db:generate` (turbo → `drizzle-kit generate`), review the SQL under `packages/db/drizzle/`, then `pnpm db:migrate` (`tsx src/migrate.ts`).
- **New FK columns are nullable in this plan.** Do NOT add `.notNull()` to `scheme_id`/`ticket_type_id` yet, and do NOT drop any `project_id` column — Plan 3 does that after backfill.
- **The five status kinds are fixed:** `todo | active | blocked | done | dropped` (enum `statusKindEnum`). `Merged`/`Deployed` map to `active`. No new kind, no new `field_type`.
- **Status keys are unique per type**, not per project — the same key (`in-progress`) recurs across types.
- **Verification is measurement** (this plan has no unit tests): run migrate + seed, then a throwaway `tsx` assertion script; plus `pnpm typecheck` and `pnpm build`. Commit after each task.
- **Conventional commits scoped by app:** `feat(db): …`, `feat(api): …`.

---

## File Structure

- `packages/db/src/schema/schemes.ts` — **Create.** The `schemes` table.
- `packages/db/src/schema/index.ts` — **Modify.** Export `schemes`.
- `packages/db/src/schema/ticket-types.ts` — **Modify.** Add nullable `scheme_id`.
- `packages/db/src/schema/fields.ts` — **Modify.** Add nullable `scheme_id`.
- `packages/db/src/schema/link-types.ts` — **Modify.** Add nullable `scheme_id`.
- `packages/db/src/schema/statuses.ts` — **Modify.** Add nullable `ticket_type_id`.
- `packages/db/src/schema/projects.ts` — **Modify.** Add nullable `scheme_id`.
- `packages/db/drizzle/NNNN_*.sql` — **Generated.** Two migrations (Tasks 1, 2).
- `packages/db/src/seed/software-scheme.ts` — **Create.** Pure data: the Software scheme definition.
- `packages/db/src/seed/seed-scheme.ts` — **Create.** `seedScheme(db, def)` inserts a scheme + its child rows.
- `packages/db/src/seed/seed-project.ts` — **Modify.** `seedProject` binds to a scheme + seeds a default view.
- `packages/db/src/run-seed.ts` — **Modify.** Ensure the Software scheme, then seed a project bound to it.
- `packages/db/src/seed/verify-scheme.ts` — **Create.** Throwaway measurement script (row counts).
- `apps/api/src/vocab/load-project-vocab.ts` — **Modify.** Load vocab by the project's `scheme_id` (fall back to `project_id` when null).

---

## Task 1: `schemes` table

**Files:**
- Create: `packages/db/src/schema/schemes.ts`
- Modify: `packages/db/src/schema/index.ts`
- Generated: `packages/db/drizzle/NNNN_*.sql`

**Interfaces:**
- Produces: `schemes` table with columns `id` (serial pk), `key` (text unique), `name` (text), `description` (text nullable), `config` (jsonb default `{}`), `archivedAt` (timestamptz nullable), `createdAt` (timestamptz default now). Drizzle export name `schemes`.

- [ ] **Step 1: Create the schema file**

Create `packages/db/src/schema/schemes.ts` (mirrors the `projects`/`ticket-types` style):

```ts
import { sql } from 'drizzle-orm';
import { jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// A reusable structure bundle: owns ticket_types, fields, link_types.
// Projects bind to a scheme (projects.scheme_id); many projects may share one.
// config holds the default-view blueprint used to seed a project's first board.
export const schemes = pgTable('schemes', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  config: jsonb('config')
    .notNull()
    .default(sql`'{}'::jsonb`),
  archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'string' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
});
```

- [ ] **Step 2: Export it**

In `packages/db/src/schema/index.ts`, add after the `projects` export (line 2):

```ts
export { schemes } from './schemes';
```

- [ ] **Step 3: Generate the migration**

Run: `pnpm db:generate`
Expected: a new file `packages/db/drizzle/0001_*.sql` containing `CREATE TABLE "schemes"`. Open it and confirm it only creates `schemes` (no other diffs yet).

- [ ] **Step 4: Apply it**

Run: `pnpm db:migrate`
Expected: stdout `migrations applied`, no error.

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: PASS (no type errors in `@tickets/db`).

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/schema/schemes.ts packages/db/src/schema/index.ts packages/db/drizzle/
git commit -m "feat(db): add schemes table"
```

---

## Task 2: Re-scope config columns (nullable, additive)

**Files:**
- Modify: `packages/db/src/schema/ticket-types.ts`, `fields.ts`, `link-types.ts`, `statuses.ts`, `projects.ts`
- Generated: `packages/db/drizzle/NNNN_*.sql`

**Interfaces:**
- Produces: `ticketTypes.schemeId`, `fields.schemeId`, `linkTypes.schemeId`, `projects.schemeId` (all `integer`, nullable, FK → `schemes.id`); `statuses.ticketTypeId` (`integer`, nullable, FK → `ticketTypes.id`). Old `projectId` columns remain.

- [ ] **Step 1: Add `scheme_id` to ticket-types**

In `packages/db/src/schema/ticket-types.ts`, add the import for `schemes` and the column. After the `projectId` block (lines 9-11) add:

```ts
    schemeId: integer('scheme_id').references(() => schemes.id),
```

Add to the imports at top: `import { schemes } from './schemes';`

- [ ] **Step 2: Add `scheme_id` to fields**

In `packages/db/src/schema/fields.ts`, add `import { schemes } from './schemes';` and, after the `projectId` block, add:

```ts
    schemeId: integer('scheme_id').references(() => schemes.id),
```

- [ ] **Step 3: Add `scheme_id` to link-types**

In `packages/db/src/schema/link-types.ts`, add `import { schemes } from './schemes';` and, after the `projectId` block (lines 9-11), add:

```ts
    schemeId: integer('scheme_id').references(() => schemes.id),
```

- [ ] **Step 4: Add `scheme_id` to projects**

In `packages/db/src/schema/projects.ts`, convert to the referenced style and add the column:

```ts
import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { schemes } from './schemes';

export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  name: text('name').notNull(),
  ticketPrefix: text('ticket_prefix').notNull(),
  schemeId: integer('scheme_id').references(() => schemes.id),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
});
```

- [ ] **Step 5: Add `ticket_type_id` to statuses**

In `packages/db/src/schema/statuses.ts`, add `import { ticketTypes } from './ticket-types';` and, after the `projectId` block (lines 10-12), add:

```ts
    ticketTypeId: integer('ticket_type_id').references(() => ticketTypes.id),
```

Leave the existing `statuses_project_key` unique constraint in place for now (Plan 3 swaps it to `(ticket_type_id, key)` after backfill).

- [ ] **Step 6: Generate the migration**

Run: `pnpm db:generate`
Expected: a new `packages/db/drizzle/0002_*.sql` adding five nullable `*_id` columns with FK constraints. Confirm every added column is nullable (no `NOT NULL`) and there are no `DROP COLUMN` statements.

- [ ] **Step 7: Apply + typecheck**

Run: `pnpm db:migrate && pnpm typecheck`
Expected: `migrations applied`, then typecheck PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/db/src/schema/ packages/db/drizzle/
git commit -m "feat(db): add nullable scheme_id / ticket_type_id ownership columns"
```

---

## Task 3: Software scheme definition (pure data)

**Files:**
- Create: `packages/db/src/seed/software-scheme.ts`

**Interfaces:**
- Produces: `SOFTWARE_SCHEME: SchemeDef` and the exported types below. Consumed by Task 4 (`seedScheme`) and Task 5 (`seedProject` reads `defaultView`).

```ts
export type StatusDef = { key: string; label: string; kind: 'todo' | 'active' | 'blocked' | 'done' | 'dropped'; initial?: boolean };
export type TypeDef = { key: string; label: string; color: string; statuses: StatusDef[]; fieldKeys: string[]; requiredFieldKeys?: string[] };
export type OptionDef = { value: string; label: string; color?: string };
export type FieldDef = { key: string; label: string; type: 'text' | 'number' | 'date' | 'boolean' | 'json' | 'select' | 'multi_select' | 'status'; system?: boolean; config?: Record<string, unknown>; options?: OptionDef[] };
export type LinkTypeDef = { key: string; label: string; inverseLabel: string; directional: boolean };
export type ViewColumnDef = { source: 'number' | 'type' | 'progress' } | { source: 'field'; fieldKey: string };
export type ViewDef = { name: string; columns: ViewColumnDef[]; sort: { source: 'number' | 'field'; fieldKey?: string; dir: 'asc' | 'desc' } };
export type SchemeDef = { key: string; name: string; description: string; types: TypeDef[]; fields: FieldDef[]; linkTypes: LinkTypeDef[]; defaultView: ViewDef };
```

- [ ] **Step 1: Write the data module**

Create `packages/db/src/seed/software-scheme.ts`. Kind→color reuses the existing seed palette.

```ts
import type { FieldDef, LinkTypeDef, SchemeDef, StatusDef, TypeDef, ViewDef } from './scheme-types';

const KIND_COLORS = {
  todo: '#3987e5',
  active: '#8f7ae8',
  blocked: '#d03b3b',
  done: '#0ca30c',
  dropped: '#898781',
} as const;

// helper so status color always tracks kind
const s = (key: string, label: string, kind: StatusDef['kind'], initial = false): StatusDef => ({
  key,
  label,
  kind,
  ...(initial ? { initial: true } : {}),
});

const types: TypeDef[] = [
  {
    key: 'epic',
    label: 'Epic',
    color: '#8f7ae8',
    statuses: [
      s('backlog', 'Backlog', 'todo', true),
      s('in-progress', 'In progress', 'active'),
      s('blocked', 'Blocked', 'blocked'),
      s('done', 'Done', 'done'),
      s('cancelled', 'Cancelled', 'dropped'),
    ],
    fieldKeys: ['title', 'description', 'status', 'priority', 'assignee', 'component', 'labels', 'target_date'],
    requiredFieldKeys: ['title'],
  },
  {
    key: 'task',
    label: 'Task',
    color: '#3987e5',
    statuses: [
      s('backlog', 'Backlog', 'todo', true),
      s('todo', 'To do', 'todo'),
      s('in-progress', 'In progress', 'active'),
      s('in-review', 'In review', 'active'),
      s('merged', 'Merged', 'active'),
      s('deployed', 'Deployed', 'active'),
      s('done', 'Done', 'done'),
      s('blocked', 'Blocked', 'blocked'),
      s('cancelled', 'Cancelled', 'dropped'),
    ],
    fieldKeys: ['title', 'description', 'status', 'priority', 'assignee', 'kind', 'component', 'labels', 'pr', 'target_date', 'estimate'],
    requiredFieldKeys: ['title'],
  },
  {
    key: 'bug',
    label: 'Bug',
    color: '#d03b3b',
    statuses: [
      s('triage', 'Triage', 'todo', true),
      s('todo', 'To do', 'todo'),
      s('in-progress', 'In progress', 'active'),
      s('in-review', 'In review', 'active'),
      s('merged', 'Merged', 'active'),
      s('deployed', 'Deployed', 'active'),
      s('fixed', 'Fixed', 'done'),
      s('blocked', 'Blocked', 'blocked'),
      s('wont-fix', "Won't fix", 'dropped'),
    ],
    fieldKeys: ['title', 'description', 'status', 'priority', 'assignee', 'component', 'labels', 'severity', 'steps', 'environment', 'pr', 'estimate'],
    requiredFieldKeys: ['title'],
  },
  {
    key: 'subtask',
    label: 'Subtask',
    color: '#898781',
    statuses: [
      s('todo', 'To do', 'todo', true),
      s('in-progress', 'In progress', 'active'),
      s('in-review', 'In review', 'active'),
      s('done', 'Done', 'done'),
      s('blocked', 'Blocked', 'blocked'),
      s('cancelled', 'Cancelled', 'dropped'),
    ],
    fieldKeys: ['title', 'description', 'status', 'priority', 'assignee', 'labels'],
    requiredFieldKeys: ['title'],
  },
  {
    key: 'spike',
    label: 'Spike',
    color: '#fab219',
    statuses: [
      s('todo', 'To do', 'todo', true),
      s('in-progress', 'In progress', 'active'),
      s('done', 'Done', 'done'),
      s('blocked', 'Blocked', 'blocked'),
      s('cancelled', 'Cancelled', 'dropped'),
    ],
    fieldKeys: ['title', 'description', 'status', 'priority', 'assignee', 'component', 'labels', 'findings', 'target_date'],
    requiredFieldKeys: ['title'],
  },
];

const fields: FieldDef[] = [
  { key: 'title', label: 'Title', type: 'text', system: true, config: { widget: 'input' } },
  { key: 'description', label: 'Description', type: 'text', system: true, config: { widget: 'markdown' } },
  { key: 'status', label: 'Status', type: 'status', system: true },
  {
    key: 'priority',
    label: 'Priority',
    type: 'select',
    system: true,
    config: { description: 'When this should get done, in order. Default Medium.' },
    options: [
      { value: 'urgent', label: 'Urgent', color: '#d03b3b' },
      { value: 'high', label: 'High', color: '#fab219' },
      { value: 'medium', label: 'Medium', color: '#3987e5' },
      { value: 'low', label: 'Low', color: '#898781' },
      { value: 'trivial', label: 'Trivial', color: '#b8b6b0' },
    ],
  },
  {
    key: 'assignee',
    label: 'Assignee',
    type: 'select',
    system: true,
    config: {
      description:
        'Which Claude model this ticket is assigned to. When planning, decide which model fits and set it: claude-fable-5 for the hardest reasoning/agentic work, claude-opus-4-8 for hard coding/agentic tasks, claude-sonnet-5 for well-specified implementation, claude-haiku-4-5 for quick mechanical changes.',
    },
    options: [
      { value: 'claude-fable-5', label: 'Fable 5', color: '#8f7ae8' },
      { value: 'claude-opus-4-8', label: 'Opus 4.8', color: '#3987e5' },
      { value: 'claude-sonnet-5', label: 'Sonnet 5', color: '#0ca30c' },
      { value: 'claude-haiku-4-5', label: 'Haiku 4.5', color: '#898781' },
    ],
  },
  {
    key: 'kind',
    label: 'Kind',
    type: 'select',
    config: { description: 'Flavor of change; matches the conventional-commit prefix.' },
    options: [
      { value: 'feat', label: 'Feature' },
      { value: 'refactor', label: 'Refactor' },
      { value: 'perf', label: 'Perf' },
      { value: 'chore', label: 'Chore' },
      { value: 'docs', label: 'Docs' },
      { value: 'test', label: 'Test' },
    ],
  },
  {
    key: 'component',
    label: 'Component',
    type: 'select',
    options: [
      { value: 'api', label: 'api' },
      { value: 'web', label: 'web' },
      { value: 'mcp', label: 'mcp' },
      { value: 'db', label: 'db' },
    ],
  },
  { key: 'labels', label: 'Labels', type: 'multi_select', options: [] },
  {
    key: 'severity',
    label: 'Severity',
    type: 'select',
    options: [
      { value: 'critical', label: 'Critical', color: '#d03b3b' },
      { value: 'high', label: 'High', color: '#fab219' },
      { value: 'medium', label: 'Medium', color: '#3987e5' },
      { value: 'low', label: 'Low', color: '#898781' },
      { value: 'cosmetic', label: 'Cosmetic', color: '#b8b6b0' },
    ],
  },
  { key: 'steps', label: 'Steps to reproduce', type: 'text', config: { widget: 'markdown' } },
  {
    key: 'environment',
    label: 'Environment',
    type: 'select',
    options: [
      { value: 'prod', label: 'prod' },
      { value: 'staging', label: 'staging' },
      { value: 'local', label: 'local' },
    ],
  },
  { key: 'pr', label: 'PR / Branch', type: 'text', config: { widget: 'link' } },
  { key: 'findings', label: 'Findings', type: 'text', config: { widget: 'markdown' } },
  { key: 'target_date', label: 'Target date', type: 'date' },
  {
    key: 'estimate',
    label: 'Estimate',
    type: 'select',
    options: [
      { value: 's', label: 'S' },
      { value: 'm', label: 'M' },
      { value: 'l', label: 'L' },
      { value: 'xl', label: 'XL' },
    ],
  },
];

const linkTypes: LinkTypeDef[] = [
  { key: 'blocks', label: 'blocks', inverseLabel: 'is blocked by', directional: true },
  { key: 'relates-to', label: 'relates to', inverseLabel: 'relates to', directional: false },
  { key: 'duplicates', label: 'duplicates', inverseLabel: 'is duplicated by', directional: true },
  { key: 'caused-by', label: 'caused by', inverseLabel: 'causes', directional: true },
];

const defaultView: ViewDef = {
  name: 'Default',
  columns: [
    { source: 'number' },
    { source: 'type' },
    { source: 'field', fieldKey: 'title' },
    { source: 'field', fieldKey: 'priority' },
    { source: 'field', fieldKey: 'assignee' },
    { source: 'progress' },
    { source: 'field', fieldKey: 'status' },
  ],
  sort: { source: 'field', fieldKey: 'priority', dir: 'desc' },
};

export const SOFTWARE_SCHEME: SchemeDef = {
  key: 'software',
  name: 'Software',
  description: 'Default software-delivery structure: Epic / Task / Bug / Subtask / Spike.',
  types,
  fields,
  linkTypes,
  defaultView,
};

export { KIND_COLORS };
```

- [ ] **Step 2: Extract the type definitions**

Create `packages/db/src/seed/scheme-types.ts` with the `export type` block from the Interfaces section above (StatusDef, TypeDef, OptionDef, FieldDef, LinkTypeDef, ViewColumnDef, ViewDef, SchemeDef). Keep it types-only so both the data module and seeder import from one place.

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS. (No runtime yet — this catches a mistyped field/status.)

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/seed/software-scheme.ts packages/db/src/seed/scheme-types.ts
git commit -m "feat(db): add Software scheme definition data"
```

---

## Task 4: `seedScheme` service

**Files:**
- Create: `packages/db/src/seed/seed-scheme.ts`
- Create: `packages/db/src/seed/verify-scheme.ts`

**Interfaces:**
- Consumes: `SchemeDef`, `KIND_COLORS`, `SOFTWARE_SCHEME` from Task 3; the `Db` type from `../client`; schema tables from `../schema`.
- Produces:
  `seedScheme(db: Db, def: SchemeDef): Promise<{ schemeId: number; typeIdByKey: Record<string, number>; fieldIdByKey: Record<string, number>; statusIdByTypeKey: Record<string, Record<string, number>> }>`

- [ ] **Step 1: Write the seeder**

Create `packages/db/src/seed/seed-scheme.ts`. It inserts one scheme, then its fields (+ options), then its types, then per-type statuses, then `ticket_type_fields` attachments. All in one transaction.

```ts
import type { Db } from '../client';
import { fieldOptions, fields, linkTypes, schemes, statuses, ticketTypeFields, ticketTypes } from '../schema';
import { KIND_COLORS } from './software-scheme';
import type { SchemeDef } from './scheme-types';

export async function seedScheme(db: Db, def: SchemeDef) {
  return db.transaction(async (tx) => {
    const [scheme] = await tx
      .insert(schemes)
      .values({ key: def.key, name: def.name, description: def.description })
      .returning();
    if (!scheme) throw new Error('scheme insert returned no row');

    // fields (+ options)
    const fieldIdByKey: Record<string, number> = {};
    for (const f of def.fields) {
      const [row] = await tx
        .insert(fields)
        .values({
          schemeId: scheme.id,
          key: f.key,
          label: f.label,
          type: f.type,
          system: f.system ?? false,
          config: f.config ?? {},
        })
        .returning();
      if (!row) throw new Error(`field insert failed: ${f.key}`);
      fieldIdByKey[f.key] = row.id;
      if (f.options && f.options.length > 0) {
        await tx.insert(fieldOptions).values(
          f.options.map((o, i) => ({
            fieldId: row.id,
            value: o.value,
            label: o.label,
            position: i,
            config: o.color ? { color: o.color } : {},
          })),
        );
      }
    }

    // types + per-type statuses + attachments
    const typeIdByKey: Record<string, number> = {};
    const statusIdByTypeKey: Record<string, Record<string, number>> = {};
    for (const [position, t] of def.types.entries()) {
      const [typeRow] = await tx
        .insert(ticketTypes)
        .values({ schemeId: scheme.id, key: t.key, label: t.label, position, config: { color: t.color } })
        .returning();
      if (!typeRow) throw new Error(`type insert failed: ${t.key}`);
      typeIdByKey[t.key] = typeRow.id;

      const byStatusKey: Record<string, number> = {};
      for (const [sPos, st] of t.statuses.entries()) {
        const [statusRow] = await tx
          .insert(statuses)
          .values({
            ticketTypeId: typeRow.id,
            key: st.key,
            label: st.label,
            kind: st.kind,
            position: sPos,
            config: { color: KIND_COLORS[st.kind], ...(st.initial ? { initial: true } : {}) },
          })
          .returning();
        if (!statusRow) throw new Error(`status insert failed: ${t.key}/${st.key}`);
        byStatusKey[st.key] = statusRow.id;
      }
      statusIdByTypeKey[t.key] = byStatusKey;

      const required = new Set(t.requiredFieldKeys ?? []);
      await tx.insert(ticketTypeFields).values(
        t.fieldKeys.map((key, i) => {
          const fieldId = fieldIdByKey[key];
          if (fieldId === undefined) throw new Error(`type ${t.key} references unknown field ${key}`);
          return { ticketTypeId: typeRow.id, fieldId, position: i, required: required.has(key) };
        }),
      );
    }

    // link types
    await tx.insert(linkTypes).values(
      def.linkTypes.map((lt, i) => ({
        schemeId: scheme.id,
        key: lt.key,
        label: lt.label,
        inverseLabel: lt.inverseLabel,
        directional: lt.directional,
        position: i,
      })),
    );

    return { schemeId: scheme.id, typeIdByKey, fieldIdByKey, statusIdByTypeKey };
  });
}
```

Note: `statuses` still has a NOT-NULL-less `ticketTypeId` (nullable) and its old `projectId` is NOT NULL in the DB from the original migration. **This will fail** because we insert statuses without a `projectId`. Fix in Step 2.

- [ ] **Step 2: Make `statuses.project_id` and `link_types.project_id` etc. nullable for scheme-owned rows**

Scheme-owned config rows have no project. In `packages/db/src/schema/statuses.ts`, `ticket-types.ts`, `fields.ts`, `link-types.ts`, remove `.notNull()` from the existing `projectId` column definitions (keep the column, keep the FK). Then:

Run: `pnpm db:generate`
Expected: `0003_*.sql` with `ALTER TABLE ... ALTER COLUMN "project_id" DROP NOT NULL` for statuses, ticket_types, fields, link_types. Review, then:
Run: `pnpm db:migrate`
Expected: `migrations applied`.

- [ ] **Step 3: Write the measurement script**

Create `packages/db/src/seed/verify-scheme.ts`:

```ts
import { count, eq } from 'drizzle-orm';
import { createDbClient } from '../client';
import { fieldOptions, fields, linkTypes, schemes, statuses, ticketTypeFields, ticketTypes } from '../schema';
import { seedScheme } from './seed-scheme';
import { SOFTWARE_SCHEME } from './software-scheme';

const { db, sql } = createDbClient({ max: 1 });
const { schemeId, typeIdByKey } = await seedScheme(db, { ...SOFTWARE_SCHEME, key: `software-verify-${Date.now()}` });

const typeIds = Object.values(typeIdByKey);
const [f] = await db.select({ n: count() }).from(fields).where(eq(fields.schemeId, schemeId));
const [t] = await db.select({ n: count() }).from(ticketTypes).where(eq(ticketTypes.schemeId, schemeId));
const [lt] = await db.select({ n: count() }).from(linkTypes).where(eq(linkTypes.schemeId, schemeId));
let statusTotal = 0;
for (const id of typeIds) {
  const [srow] = await db.select({ n: count() }).from(statuses).where(eq(statuses.ticketTypeId, id));
  statusTotal += Number(srow?.n ?? 0);
}
console.log({ fields: Number(f?.n), types: Number(t?.n), linkTypes: Number(lt?.n), statuses: statusTotal });
await sql.end();
```

- [ ] **Step 4: Run it**

Run: `pnpm --filter @tickets/db exec tsx src/seed/verify-scheme.ts`
Expected output exactly: `{ fields: 15, types: 5, linkTypes: 4, statuses: 34 }`
(5+9+9+6+5 = 34 statuses; 15 fields; 5 types; 4 link types.) If any number differs, fix the data/seeder before continuing.

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm typecheck`
Expected: PASS.

```bash
git add packages/db/src/seed/seed-scheme.ts packages/db/src/seed/verify-scheme.ts packages/db/src/schema/ packages/db/drizzle/
git commit -m "feat(db): seedScheme service + drop NOT NULL on scheme-owned project_id"
```

---

## Task 5: Bind projects to a scheme + seed default view

**Files:**
- Modify: `packages/db/src/seed/seed-project.ts`
- Modify: `packages/db/src/run-seed.ts`

**Interfaces:**
- Consumes: `seedScheme`, `SOFTWARE_SCHEME`, and the `fieldIdByKey`/`defaultView` to build the view config.
- Produces: `seedProject(db, { key, name, ticketPrefix, schemeId, fieldIdByKey })` inserts a project row with `schemeId` set and one `views` row whose `config` resolves the `defaultView` blueprint's `fieldKey`s to field ids.

- [ ] **Step 1: Rewrite `seed-project.ts`**

Replace the whole file. The project now binds to a pre-seeded scheme and only owns its default view; all types/statuses/fields/links come from the scheme.

```ts
import type { Db } from '../client';
import { projects, views } from '../schema';
import { SOFTWARE_SCHEME } from './software-scheme';
import type { ViewColumnDef } from './scheme-types';

export async function seedProject(
  db: Db,
  input: { key: string; name: string; ticketPrefix: string; schemeId: number; fieldIdByKey: Record<string, number> },
) {
  return db.transaction(async (tx) => {
    const [project] = await tx
      .insert(projects)
      .values({ key: input.key, name: input.name, ticketPrefix: input.ticketPrefix, schemeId: input.schemeId })
      .returning();
    if (!project) throw new Error('project insert returned no row');

    const resolveColumn = (col: ViewColumnDef) => {
      if (col.source === 'field') {
        const fieldId = input.fieldIdByKey[col.fieldKey];
        if (fieldId === undefined) throw new Error(`default view references unknown field ${col.fieldKey}`);
        return { source: 'field', fieldId };
      }
      return col;
    };
    const view = SOFTWARE_SCHEME.defaultView;
    const sort =
      view.sort.source === 'field'
        ? { source: 'field', fieldId: input.fieldIdByKey[view.sort.fieldKey!], dir: view.sort.dir }
        : { source: view.sort.source, dir: view.sort.dir };

    await tx.insert(views).values({
      projectId: project.id,
      name: view.name,
      position: 0,
      config: { columns: view.columns.map(resolveColumn), sort, filters: {} },
    });

    return { project };
  });
}
```

- [ ] **Step 2: Rewrite `run-seed.ts` to ensure the scheme, then the project**

```ts
import { eq } from 'drizzle-orm';
import { createDbClient } from './client';
import { fields, schemes } from './schema';
import { seedProject } from './seed/seed-project';
import { seedScheme } from './seed/seed-scheme';
import { SOFTWARE_SCHEME } from './seed/software-scheme';

const [key, name, ticketPrefix] = process.argv.slice(2);
if (!key || !name || !ticketPrefix) {
  console.error('usage: pnpm db:seed <key> <name> <ticket-prefix>');
  process.exit(1);
}

const { db, sql } = createDbClient({ max: 1 });

// Ensure the shared Software scheme exists, then seed its ids for the view.
const existing = await db.select().from(schemes).where(eq(schemes.key, SOFTWARE_SCHEME.key));
let schemeId: number;
let fieldIdByKey: Record<string, number>;
if (existing[0]) {
  schemeId = existing[0].id;
  const fieldRows = await db.select().from(fields).where(eq(fields.schemeId, schemeId));
  fieldIdByKey = Object.fromEntries(fieldRows.map((r) => [r.key, r.id]));
} else {
  const seeded = await seedScheme(db, SOFTWARE_SCHEME);
  schemeId = seeded.schemeId;
  fieldIdByKey = seeded.fieldIdByKey;
}

const seeded = await seedProject(db, { key, name, ticketPrefix, schemeId, fieldIdByKey });
await sql.end();
console.log(`seeded project ${seeded.project.key} (#${seeded.project.id}) bound to scheme #${schemeId}`);
```

- [ ] **Step 3: Measurement — fresh seed of a project**

Run: `pnpm db:seed demo Demo DEMO`
Expected: stdout `seeded project demo (#N) bound to scheme #M`, no error. Re-run with a different key `pnpm db:seed demo2 Demo2 DEMO2` — expected: it reuses the **same** scheme #M (not a new one), confirming sharing.

- [ ] **Step 4: Typecheck + commit**

Run: `pnpm typecheck`
Expected: PASS.

```bash
git add packages/db/src/seed/seed-project.ts packages/db/src/run-seed.ts
git commit -m "feat(db): bind seeded projects to the shared Software scheme"
```

---

## Task 6: Load vocab by scheme

**Files:**
- Modify: `apps/api/src/vocab/load-project-vocab.ts`

**Interfaces:**
- Consumes: `projects.schemeId`, `ticketTypes.schemeId`, `fields.schemeId`, `linkTypes.schemeId`, `statuses.ticketTypeId`.
- Produces: unchanged `ProjectVocab` shape (same keys/maps). Only the WHERE clauses change: types/fields/linkTypes filtered by `scheme_id`; statuses filtered by `ticket_type_id ∈ the scheme's type ids`. Falls back to the old `project_id` filters when `project.schemeId` is null (pre-migration projects).

- [ ] **Step 1: Update the loader**

In `apps/api/src/vocab/load-project-vocab.ts`, replace the parallel load block (lines 30-38) and the transitions filter. Types/fields/linkTypes key off the scheme; statuses key off the scheme's types:

```ts
  const schemeId = project.schemeId;

  const [typeRows, fieldRows, linkTypeRows, viewRows] = await Promise.all([
    schemeId != null
      ? db.select().from(ticketTypes).where(eq(ticketTypes.schemeId, schemeId))
      : db.select().from(ticketTypes).where(eq(ticketTypes.projectId, project.id)),
    schemeId != null
      ? db.select().from(fields).where(eq(fields.schemeId, schemeId))
      : db.select().from(fields).where(eq(fields.projectId, project.id)),
    schemeId != null
      ? db.select().from(linkTypes).where(eq(linkTypes.schemeId, schemeId))
      : db.select().from(linkTypes).where(eq(linkTypes.projectId, project.id)),
    db.select().from(views).where(eq(views.projectId, project.id)),
  ]);

  const typeIds = typeRows.map((row) => row.id);
  const statusRows =
    typeIds.length > 0
      ? await db.select().from(statuses).where(inArray(statuses.ticketTypeId, typeIds))
      : schemeId != null
        ? []
        : await db.select().from(statuses).where(eq(statuses.projectId, project.id));

  const transitionRows = await db.select().from(statusTransitions);
```

Keep the rest of the function (options/typeFields loads, the `statusIds`/`projectTransitions` filter, and the returned maps) unchanged — they already key off `fieldIds`/`statusRows`/`typeRows`.

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS across `@tickets/api`.

- [ ] **Step 3: Measurement — board endpoint reflects the scheme**

Ensure the API is running against the migrated DB (`docker compose up -d`, or `pnpm --filter @tickets/api dev`). With the `demo` project seeded in Task 5:

Run: `curl -s http://localhost:4600/api/projects/demo/board | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const b=JSON.parse(s);console.log({types:b.types.length,fields:b.fields.length});})"`
Expected: `{ types: 5, fields: 15 }` (served via the scheme, not per-project rows). If the route path differs, confirm it in `apps/api/src/routes/projects.routes.ts` and adjust the URL.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/vocab/load-project-vocab.ts
git commit -m "feat(api): load project vocab from the bound scheme"
```

---

## Task 7: End-to-end foundation check

**Files:** none (verification only).

- [ ] **Step 1: Clean rebuild from scratch**

Against a scratch database (or after `pnpm db:migrate`), run a fresh project seed and confirm the whole chain:

Run: `pnpm db:seed acme Acme ACME`
Expected: `seeded project acme (#N) bound to scheme #M`.

- [ ] **Step 2: Full typecheck + build**

Run: `pnpm typecheck && pnpm build`
Expected: both PASS (turbo builds `@tickets/db`, `@tickets/api`, `@tickets/web`, `@tickets/mcp`).

- [ ] **Step 3: Confirm sharing invariant**

Run: `pnpm --filter @tickets/db exec tsx -e "import{createDbClient}from './src/client';import{schemes,projects}from './src/schema';const{db,sql}=createDbClient({max:1});const sc=await db.select().from(schemes);const pr=await db.select().from(projects);console.log({schemes:sc.length,projectsBound:pr.filter(p=>p.schemeId!=null).length});await sql.end();"`
Expected: `schemes: 1` (only Software) and `projectsBound` equals the number of projects you seeded — proving all projects share the one scheme.

- [ ] **Step 4: Final commit (if any cleanup)**

```bash
git add -A
git commit -m "chore(db): scheme foundation end-to-end verified"
```

---

## Self-review notes (author)

- **Spec coverage:** schemes table ✓ (Task 1); re-scope ticket_types/fields/link_types → scheme + statuses → type ✓ (Task 2, nullable); projects.scheme_id ✓ (Task 2); Software scheme content = 5 types, per-type statuses, 15 fields incl. Assignee/Kind/PR/Component, 4 link types incl. caused-by, default-view blueprint ✓ (Task 3); seedScheme ✓ (Task 4); project binds + shares one scheme ✓ (Tasks 5, 7); loadProjectVocab reads by scheme ✓ (Task 6). **Deferred to later plans (intentionally):** transitions graph + guards + type-aware hierarchy + cloneScheme (Plan 2); backfilling the 4 existing projects, remapping tickets, dropping old `project_id` columns, and tightening `NOT NULL` (Plan 3).
- **No placeholders:** every code step shows full code; every run step shows an exact command + expected output.
- **Type consistency:** `SchemeDef`/`TypeDef`/`FieldDef` in `scheme-types.ts` match usage in `software-scheme.ts` and `seed-scheme.ts`; `seedScheme` return shape (`schemeId`, `fieldIdByKey`, `typeIdByKey`, `statusIdByTypeKey`) matches its consumers in `run-seed.ts` and `verify-scheme.ts`.
- **Non-breaking:** new columns nullable, old columns retained, `loadProjectVocab` falls back to `project_id` — pre-migration projects keep working until Plan 3.
