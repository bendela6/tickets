# Type-owned Fields & Links — Plan A: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make ticket **Types** own their fields (+ options) and their outgoing link types (+ allowed target types) at the schema/seed/vocab layer, verified on a fresh dev DB. No live-data migration here (Plan C) and no API/board changes here (Plan B).

**Architecture:** Expand-only schema change following the project's expand→migrate→contract discipline: add the new type-owned columns/tables as **nullable**, keep the old `scheme_id` columns and `ticket_type_fields` table in place (Plan C contracts them). The seed materializes a **per-type copy** of each catalog field and per-type link types from a still-DRY `SchemeDef`. `loadProjectVocab` and `cloneScheme` are rewired to the type-owned rows.

**Tech Stack:** pnpm + turbo monorepo; `@tickets/db` = Drizzle ORM 0.45 + drizzle-kit 0.31 + postgres-js; tsx; vitest ^4.1.10.

## Global Constraints

- **Two Postgres DBs.** `db:migrate`/`db:seed`/tsx scripts hit the **dev** postgres on host port **5532** (via `.env`). The **docker** postgres (unpublished, serves the live api:4600) is untouched in this plan. Never point db tooling at the docker DB here.
- **Expand/migrate/contract.** In this plan the schema stays **loose**: new columns `fields.ticket_type_id`, `fields.position`, `link_types.ticket_type_id` are **nullable**; `fields.required` is `NOT NULL DEFAULT false` (safe `ADD COLUMN` on populated tables — mirrors `ticket_type_fields.required`); `fields.scheme_id` and `link_types.scheme_id` become **nullable but stay**; `ticket_type_fields` table **stays** (unused by the new seed). The only rule is: no `SET NOT NULL` on the type-owned nullable columns and no `DROP` of `scheme_id`/`ticket_type_fields` here — Plan C does that.
- **Migrations are drizzle-kit-generated.** After editing `packages/db/src/schema/*.ts`, run `pnpm --filter @tickets/db exec drizzle-kit generate` and commit the generated `packages/db/drizzle/00NN_*.sql` + `meta/` snapshot + `_journal.json`. Do not hand-name migrations.
- **Field type enum already includes `status`.** The `status` field is a proxy: its value lives in `ticket_values.status_id` → per-type `statuses` (already type-owned). Nothing to change there.
- **Verify by fresh dev DB, not the live data.** Each verification drops+recreates a scratch dev database, runs `db:migrate` + a scheme seed, and asserts via tsx/vitest.
- Conventional commits scoped `feat(db): …`; **one commit per task**.

## File Structure

- `packages/db/src/schema/fields.ts` — add `ticketTypeId`, `position`, `required` (nullable); make `schemeId` nullable; keep unique `(scheme_id, key)` for now, add non-unique index helper later in Plan C.
- `packages/db/src/schema/link-types.ts` — add `ticketTypeId` (nullable); make `schemeId` nullable.
- `packages/db/src/schema/link-type-target-types.ts` — **new** junction table.
- `packages/db/src/schema/index.ts` — export the new table.
- `packages/db/src/seed/scheme-types.ts` — extend `TypeDef` with optional per-type `linkKeys`; keep the DRY `fields`/`linkTypes` catalogs.
- `packages/db/src/seed/software-scheme.ts` — no field-catalog change; optionally declare per-type `linkKeys` (defaults cover it).
- `packages/db/src/seed/seed-scheme.ts` — materialize per-type fields (+options) and per-type link types (+targets); stop writing `ticket_type_fields`; return `fieldIdByTypeKey`.
- `packages/db/src/seed/ensure-software-scheme.ts` — return `{ schemeId, typeIdByKey }` (drop scheme-wide `fieldIdByKey`).
- `packages/db/src/seed/seed-project.ts` — store default-view columns/sort by **fieldKey** (stop translating to ids).
- `apps/api/src/vocab/load-project-vocab.ts` — load fields per type; add `fieldByTypeKey`, `fieldsByType`, `fieldKeys`, `linkTypesByType`, `linkTypeTargets`.
- `apps/api/src/schemes/clone-scheme.ts` — clone per-type fields+options, per-type link types + target rows; drop `ticket_type_fields` clone.
- Tests: `packages/db/src/seed/seed-scheme.test.ts` (new), `apps/api/src/schemes/clone-scheme.test.ts` (extend).

---

### Task 1: `link_type_target_types` table + schema loosening

**Files:**
- Create: `packages/db/src/schema/link-type-target-types.ts`
- Modify: `packages/db/src/schema/fields.ts`, `packages/db/src/schema/link-types.ts`, `packages/db/src/schema/index.ts`
- Migration: `packages/db/drizzle/00NN_*.sql` (generated)

**Interfaces:**
- Produces: `linkTypeTargetTypes` table `(linkTypeId, targetTypeId)` PK; `fields.ticketTypeId/position/required` (nullable); `linkTypes.ticketTypeId` (nullable). Consumed by Tasks 2–5.

- [ ] **Step 1: Create the junction table**

`packages/db/src/schema/link-type-target-types.ts`:
```ts
import { integer, pgTable, primaryKey } from 'drizzle-orm/pg-core';
import { linkTypes } from './link-types';
import { ticketTypes } from './ticket-types';

// Valid target types for a (source-type-owned) link type.
export const linkTypeTargetTypes = pgTable(
  'link_type_target_types',
  {
    linkTypeId: integer('link_type_id')
      .notNull()
      .references(() => linkTypes.id),
    targetTypeId: integer('target_type_id')
      .notNull()
      .references(() => ticketTypes.id),
  },
  (table) => [primaryKey({ columns: [table.linkTypeId, table.targetTypeId] })],
);
```

- [ ] **Step 2: Loosen `fields.ts`** — add nullable type-owned columns, make `schemeId` nullable:
```ts
// in fields table definition:
schemeId: integer('scheme_id').references(() => schemes.id),          // was .notNull()
ticketTypeId: integer('ticket_type_id').references(() => ticketTypes.id),
position: integer('position'),
required: boolean('required').notNull().default(false),
```
Add `import { ticketTypes } from './ticket-types';`. Keep the existing `unique('fields_scheme_key')` for now.

- [ ] **Step 3: Loosen `link-types.ts`** — make `schemeId` nullable, add nullable `ticketTypeId`:
```ts
schemeId: integer('scheme_id').references(() => schemes.id),          // was .notNull()
ticketTypeId: integer('ticket_type_id').references(() => ticketTypes.id),
```
Add `import { ticketTypes } from './ticket-types';`. Keep the existing unique for now.

- [ ] **Step 4: Export the new table** — in `packages/db/src/schema/index.ts` add:
```ts
export { linkTypeTargetTypes } from './link-type-target-types';
```

- [ ] **Step 5: Generate the migration**

Run: `pnpm --filter @tickets/db exec drizzle-kit generate`
Expected: a new `packages/db/drizzle/00NN_*.sql` creating `link_type_target_types`, adding the nullable columns, and dropping the NOT NULL on the two `scheme_id` columns. Open it and confirm there is **no** `DROP TABLE ticket_type_fields` and **no** `SET NOT NULL` on the new columns.

- [ ] **Step 6: Verify migration applies on a fresh dev DB**

Run:
```bash
cd packages/db
POSTGRES_DATABASE=tozf_a1 pnpm exec tsx -e "import {createDbClient} from './src/client'; const {sql}=createDbClient({max:1}); await sql\`CREATE DATABASE tozf_a1\`.catch(()=>{}); await sql.end();"
POSTGRES_DATABASE=tozf_a1 pnpm db:migrate
```
Expected: migrations run through the new one with no error. (Scratch DB `tozf_a1` is dropped in Task 5's verify.)

- [ ] **Step 7: Commit**
```bash
git add packages/db/src/schema packages/db/drizzle
git commit -m "feat(db): expand schema for type-owned fields & links (nullable)"
```

---

### Task 2: `SchemeDef` per-type link ownership

**Files:**
- Modify: `packages/db/src/seed/scheme-types.ts`, `packages/db/src/seed/software-scheme.ts`

**Interfaces:**
- Produces: `TypeDef.linkKeys?: { key: string; targetTypeKeys: string[] }[]`. When omitted, the seed (Task 3) defaults a type to own **every** catalog link with **all** types as targets. Consumed by Task 3.

- [ ] **Step 1: Extend `TypeDef`** in `scheme-types.ts`:
```ts
export type TypeLinkDef = { key: string; targetTypeKeys: string[] };

export type TypeDef = {
  key: string;
  label: string;
  color: string;
  statuses: StatusDef[];
  fieldKeys: string[];
  requiredFieldKeys?: string[];
  allowedChildTypes?: string[];
  linkKeys?: TypeLinkDef[];        // NEW — omit to inherit all catalog links → all types
};
```

- [ ] **Step 2: (Optional) declare explicit per-type links in `software-scheme.ts`**

Leave `linkKeys` off every type for now so the default (all links, all targets) applies — this reproduces today's "any link between any tickets" behavior while making links type-owned structurally. No data change needed. (A later curation pass can tighten targets via the API.)

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @tickets/db typecheck` (or `pnpm typecheck`)
Expected: passes.

- [ ] **Step 4: Commit**
```bash
git add packages/db/src/seed/scheme-types.ts packages/db/src/seed/software-scheme.ts
git commit -m "feat(db): SchemeDef per-type link ownership (defaults to all)"
```

---

### Task 3: `seedScheme` materializes per-type fields + links

**Files:**
- Modify: `packages/db/src/seed/seed-scheme.ts`
- Test: `packages/db/src/seed/seed-scheme.test.ts` (new)

**Interfaces:**
- Consumes: `SchemeDef` (catalog `fields`/`linkTypes` + per-type `fieldKeys`/`requiredFieldKeys`/`linkKeys`).
- Produces: `seedScheme` returns `{ schemeId, typeIdByKey, fieldIdByTypeKey, statusIdByTypeKey }` where `fieldIdByTypeKey: Record<typeKey, Record<fieldKey, number>>`. Writes per-type `fields` (+`fieldOptions`), per-type `linkTypes` (+`linkTypeTargetTypes`). **No** `ticketTypeFields` rows.

- [ ] **Step 1: Write the failing test** — `seed-scheme.test.ts` seeds `SOFTWARE_SCHEME` into a fresh scratch DB and asserts per-type ownership. Use the existing test DB harness pattern (see `build-transitions.test.ts`). Core assertions:
```ts
// after seedScheme(db, SOFTWARE_SCHEME):
// 1. every type owns a 'priority' field row that is distinct per type
const prio = await db.select().from(fields).where(eq(fields.key, 'priority'));
expect(prio.length).toBe(5);                        // one per type
expect(new Set(prio.map((f) => f.ticketTypeId)).size).toBe(5);
// 2. options duplicated per type-field
for (const f of prio) {
  const opts = await db.select().from(fieldOptions).where(eq(fieldOptions.fieldId, f.id));
  expect(opts.map((o) => o.value)).toEqual(['urgent','high','medium','low','trivial']);
}
// 3. no ticket_type_fields rows written
expect((await db.select().from(ticketTypeFields)).length).toBe(0);
// 4. link types owned per type + targets present
const taskType = (await db.select().from(ticketTypes).where(eq(ticketTypes.key,'task')))[0];
const taskLinks = await db.select().from(linkTypes).where(eq(linkTypes.ticketTypeId, taskType.id));
expect(taskLinks.map((l) => l.key).sort()).toEqual(['blocks','caused-by','duplicates','relates-to']);
const blocks = taskLinks.find((l) => l.key === 'blocks')!;
const targets = await db.select().from(linkTypeTargetTypes).where(eq(linkTypeTargetTypes.linkTypeId, blocks.id));
expect(targets.length).toBe(5);                     // default: all types
```

- [ ] **Step 2: Run it — fails** (`seedScheme` still writes shared fields / `ticket_type_fields`).
Run: `pnpm --filter @tickets/db test seed-scheme`
Expected: FAIL.

- [ ] **Step 3: Rewrite `seedScheme`.** Replace the field/type/link sections:

```ts
export async function seedScheme(db: Db, def: SchemeDef) {
  return db.transaction(async (tx) => {
    const [scheme] = await tx
      .insert(schemes)
      .values({ key: def.key, name: def.name, description: def.description })
      .returning();
    if (!scheme) throw new Error('scheme insert returned no row');

    const fieldCatalog = new Map(def.fields.map((f) => [f.key, f]));
    const linkCatalog = new Map(def.linkTypes.map((l) => [l.key, l]));

    const typeIdByKey: Record<string, number> = {};
    const statusIdByTypeKey: Record<string, Record<string, number>> = {};
    const fieldIdByTypeKey: Record<string, Record<string, number>> = {};

    // pass 1: types + statuses + transitions + per-type fields (+options)
    for (const [position, t] of def.types.entries()) {
      const [typeRow] = await tx
        .insert(ticketTypes)
        .values({
          schemeId: scheme.id,
          key: t.key,
          label: t.label,
          position,
          config: { color: t.color, allowedChildTypes: t.allowedChildTypes ?? [] },
        })
        .returning();
      if (!typeRow) throw new Error(`type insert failed: ${t.key}`);
      typeIdByKey[t.key] = typeRow.id;

      // statuses
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

      const edgeDefs = buildTransitions(t);
      if (edgeDefs.length > 0) {
        await tx.insert(statusTransitions).values(
          edgeDefs.map((e) => ({
            fromStatusId: e.fromKey === null ? null : byStatusKey[e.fromKey]!,
            toStatusId: byStatusKey[e.toKey]!,
            ticketTypeId: typeRow.id,
            config: e.config ?? {},
          })),
        );
      }

      // per-type fields (materialize a copy of each referenced catalog field)
      const required = new Set(t.requiredFieldKeys ?? []);
      const byFieldKey: Record<string, number> = {};
      for (const [i, key] of t.fieldKeys.entries()) {
        const f = fieldCatalog.get(key);
        if (!f) throw new Error(`type ${t.key} references unknown field ${key}`);
        const [row] = await tx
          .insert(fields)
          .values({
            ticketTypeId: typeRow.id,
            key: f.key,
            label: f.label,
            type: f.type,
            system: f.system ?? false,
            required: required.has(key),
            position: i,
            config: f.config ?? {},
          })
          .returning();
        if (!row) throw new Error(`field insert failed: ${t.key}/${key}`);
        byFieldKey[key] = row.id;
        if (f.options && f.options.length > 0) {
          await tx.insert(fieldOptions).values(
            f.options.map((o, oi) => ({
              fieldId: row.id,
              value: o.value,
              label: o.label,
              position: oi,
              config: o.color ? { color: o.color } : {},
            })),
          );
        }
      }
      fieldIdByTypeKey[t.key] = byFieldKey;
    }

    // pass 2: per-type link types (+ target rows) — needs all type ids resolved
    const allTypeKeys = def.types.map((t) => t.key);
    for (const t of def.types) {
      const owned = t.linkKeys ?? allCatalogLinks(linkCatalog, allTypeKeys);
      for (const [i, decl] of owned.entries()) {
        const lt = linkCatalog.get(decl.key);
        if (!lt) throw new Error(`type ${t.key} references unknown link ${decl.key}`);
        const [row] = await tx
          .insert(linkTypes)
          .values({
            ticketTypeId: typeIdByKey[t.key]!,
            key: lt.key,
            label: lt.label,
            inverseLabel: lt.inverseLabel,
            directional: lt.directional,
            position: i,
          })
          .returning();
        if (!row) throw new Error(`link insert failed: ${t.key}/${decl.key}`);
        const targetIds = decl.targetTypeKeys.map((k) => {
          const id = typeIdByKey[k];
          if (id === undefined) throw new Error(`link ${t.key}/${decl.key} unknown target ${k}`);
          return id;
        });
        if (targetIds.length > 0) {
          await tx
            .insert(linkTypeTargetTypes)
            .values(targetIds.map((targetTypeId) => ({ linkTypeId: row.id, targetTypeId })));
        }
      }
    }

    return { schemeId: scheme.id, typeIdByKey, fieldIdByTypeKey, statusIdByTypeKey };
  });
}

// default: a type owns every catalog link, targeting all types
function allCatalogLinks(
  linkCatalog: Map<string, { key: string }>,
  allTypeKeys: string[],
): { key: string; targetTypeKeys: string[] }[] {
  return [...linkCatalog.keys()].map((key) => ({ key, targetTypeKeys: allTypeKeys }));
}
```
Update imports: drop `ticketTypeFields`; add `linkTypeTargetTypes`.

- [ ] **Step 4: Run the test — passes.**
Run: `pnpm --filter @tickets/db test seed-scheme`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add packages/db/src/seed/seed-scheme.ts packages/db/src/seed/seed-scheme.test.ts
git commit -m "feat(db): seed per-type fields+options and per-type link types"
```

---

### Task 4: `ensureSoftwareScheme` + `seedProject` (key-based default view)

**Files:**
- Modify: `packages/db/src/seed/ensure-software-scheme.ts`, `packages/db/src/seed/seed-project.ts`
- Also update callers if signature changes: `packages/db/src/run-seed.ts`, `apps/api/src/routes/projects.routes.ts`

**Interfaces:**
- Produces: `ensureSoftwareScheme(db) → { schemeId, typeIdByKey }`. `seedProject` writes view columns/sort as `{ source:'field', fieldKey }` (no id translation).

- [ ] **Step 1: Rewrite `ensure-software-scheme.ts`** to not depend on scheme-wide field ids:
```ts
export async function ensureSoftwareScheme(
  db: Db,
): Promise<{ schemeId: number; typeIdByKey: Record<string, number> }> {
  const existing = await db.select().from(schemes).where(eq(schemes.key, SOFTWARE_SCHEME.key));
  if (existing[0]) {
    const typeRows = await db.select().from(ticketTypes).where(eq(ticketTypes.schemeId, existing[0].id));
    return { schemeId: existing[0].id, typeIdByKey: Object.fromEntries(typeRows.map((t) => [t.key, t.id])) };
  }
  const seeded = await seedScheme(db, SOFTWARE_SCHEME);
  return { schemeId: seeded.schemeId, typeIdByKey: seeded.typeIdByKey };
}
```
Update imports (`ticketTypes` instead of `fields`).

- [ ] **Step 2: Rewrite `seedProject`** to store keys. Change the signature to drop `fieldIdByKey`, and store the blueprint columns/sort verbatim (they are already `fieldKey`-shaped in `SOFTWARE_SCHEME.defaultView`):
```ts
export async function seedProject(
  db: Db,
  input: { key: string; name: string; ticketPrefix: string; schemeId: number },
) {
  return db.transaction(async (tx) => {
    const [project] = await tx
      .insert(projects)
      .values({ key: input.key, name: input.name, ticketPrefix: input.ticketPrefix, schemeId: input.schemeId })
      .returning();
    if (!project) throw new Error('project insert returned no row');

    const view = SOFTWARE_SCHEME.defaultView;
    await tx.insert(views).values({
      projectId: project.id,
      name: view.name,
      position: 0,
      config: { columns: view.columns, sort: view.sort, filters: {} }, // fieldKey-shaped already
    });
    return { project };
  });
}
```

- [ ] **Step 3: Fix callers** — update `run-seed.ts` and `projects.routes.ts` to call `seedProject` without `fieldIdByKey` and `ensureSoftwareScheme`’s new return. Grep first:
Run: `git grep -n "fieldIdByKey\|seedProject(" -- packages apps`
Fix each call site to the new signatures.

- [ ] **Step 4: Typecheck**
Run: `pnpm typecheck`
Expected: passes.

- [ ] **Step 5: Commit**
```bash
git add packages/db/src/seed apps/api/src/routes/projects.routes.ts packages/db/src/run-seed.ts
git commit -m "feat(db): key-based default view + scheme ensure returns type ids"
```

---

### Task 5: `loadProjectVocab` reads fields/links per type

**Files:**
- Modify: `apps/api/src/vocab/load-project-vocab.ts`

**Interfaces:**
- Produces on `ProjectVocab`: `fieldByTypeKey: Map<"typeId:key", Field>`, `fieldsByType: Map<number, Field[]>`, `fieldKeys: { key; label; type }[]`, `linkTypesByType: Map<number, LinkType[]>`, `linkTypeTargets: Map<number, Set<number>>`. Keep `fieldById`. `fieldByKey` and `linkTypeByKey` are **removed** (ambiguous under per-type ownership) — Plan B updates their consumers.

- [ ] **Step 1: Load fields by type id, link targets, and build maps.** Replace the `fields`/`linkTypes` loads:
```ts
// fields now belong to types, not the scheme
const fieldRows = typeIds.length > 0
  ? await db.select().from(fields).where(inArray(fields.ticketTypeId, typeIds))
  : [];
const linkTypeRows = typeIds.length > 0
  ? await db.select().from(linkTypes).where(inArray(linkTypes.ticketTypeId, typeIds))
  : [];
const linkTargetRows = linkTypeRows.length > 0
  ? await db.select().from(linkTypeTargetTypes)
      .where(inArray(linkTypeTargetTypes.linkTypeId, linkTypeRows.map((l) => l.id)))
  : [];
```
Add `linkTypeTargetTypes` to the `@tickets/db` import. Remove the `ticketTypeFields` load (Plan B/C removes remaining consumers; keep `typeFields` out of the return).

- [ ] **Step 2: Build the new maps in the return object:**
```ts
fieldByTypeKey: new Map(fieldRows.map((r) => [`${r.ticketTypeId}:${r.key}`, r])),
fieldsByType: fieldRows.reduce((m, r) => {
  const b = m.get(r.ticketTypeId!) ?? []; b.push(r); m.set(r.ticketTypeId!, b); return m;
}, new Map<number, typeof fieldRows>()),
fieldKeys: dedupeByKey(fieldRows).map((r) => ({ key: r.key, label: r.label, type: r.type })),
linkTypesByType: linkTypeRows.reduce((m, r) => {
  const b = m.get(r.ticketTypeId!) ?? []; b.push(r); m.set(r.ticketTypeId!, b); return m;
}, new Map<number, typeof linkTypeRows>()),
linkTypeTargets: linkTargetRows.reduce((m, r) => {
  const s = m.get(r.linkTypeId) ?? new Set<number>(); s.add(r.targetTypeId); m.set(r.linkTypeId, s); return m;
}, new Map<number, Set<number>>()),
fieldById: new Map(fieldRows.map((r) => [r.id, r])),
// keep: optionsByFieldId, optionById, statuses maps, typeBy*, etc.
```
Add a module-local helper `dedupeByKey` (first field row seen per key, non-archived preferred) to derive the logical column list. Sort `fieldsByType` buckets by `position` before returning.

- [ ] **Step 3: Fix the sort** — after building `fieldsByType`, sort each bucket:
```ts
for (const bucket of fieldsByTypeMap.values()) bucket.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
```
(Compute the map in a local `const` first, then reference it in the return.)

- [ ] **Step 4: Typecheck the API** — expect errors only in Plan B consumers (`buildValueRows`, `assembleTickets`, `validate-view-config`, `vocabulary.routes`, `links.routes`) that still reference `fieldByKey`/`linkTypeByKey`/`typeFields`. Leave those for Plan B; confirm `load-project-vocab.ts` itself compiles in isolation.
Run: `pnpm --filter @tickets/api exec tsc --noEmit 2>&1 | head -40`
Expected: failures are confined to the known Plan B files (record them at the top of Plan B).

- [ ] **Step 5: Commit**
```bash
git add apps/api/src/vocab/load-project-vocab.ts
git commit -m "feat(api): load fields & link types per type into vocab"
```

---

### Task 6: `cloneScheme` clones per-type fields, links, targets

**Files:**
- Modify: `apps/api/src/schemes/clone-scheme.ts`
- Test: `apps/api/src/schemes/clone-scheme.test.ts`

**Interfaces:**
- Consumes: type-owned `fields`/`linkTypes` + `linkTypeTargetTypes`. Produces a deep copy with fresh ids and remapped FKs.

- [ ] **Step 1: Update the failing test** to assert cloned fields carry `ticketTypeId` remapped to the cloned types, and target rows are remapped:
```ts
// after cloneScheme(db, srcSchemeId, {key,name}):
const clonedTypes = await db.select().from(ticketTypes).where(eq(ticketTypes.schemeId, dstId));
const clonedFields = await db.select().from(fields)
  .where(inArray(fields.ticketTypeId, clonedTypes.map((t) => t.id)));
expect(clonedFields.length).toBe(srcFieldCount);          // same per-type field count
// every cloned field points at a cloned type
const clonedTypeIds = new Set(clonedTypes.map((t) => t.id));
expect(clonedFields.every((f) => clonedTypeIds.has(f.ticketTypeId))).toBe(true);
```

- [ ] **Step 2: Run — fails** (clone still queries `fields.schemeId`, clones `ticket_type_fields`).

- [ ] **Step 3: Rewrite the fields/links sections** of `cloneScheme`:
```ts
// fields (per type) → options
const srcFields = srcTypes.length
  ? await tx.select().from(fields).where(inArray(fields.ticketTypeId, srcTypes.map((t) => t.id)))
  : [];
const fieldIdMap = new Map<number, number>();
for (const f of srcFields) {
  const [n] = await tx.insert(fields).values({
    ticketTypeId: typeIdMap.get(f.ticketTypeId!)!,
    key: f.key, label: f.label, type: f.type, system: f.system,
    required: f.required, position: f.position, config: f.config,
  }).returning();
  fieldIdMap.set(f.id, n!.id);
}
const srcOptions = srcFields.length
  ? await tx.select().from(fieldOptions).where(inArray(fieldOptions.fieldId, srcFields.map((f) => f.id)))
  : [];
if (srcOptions.length) await tx.insert(fieldOptions).values(remapClonedRows(srcOptions, 'fieldId', fieldIdMap));

// link types (per type) + targets
const srcLinks = srcTypes.length
  ? await tx.select().from(linkTypes).where(inArray(linkTypes.ticketTypeId, srcTypes.map((t) => t.id)))
  : [];
const linkIdMap = new Map<number, number>();
for (const l of srcLinks) {
  const [n] = await tx.insert(linkTypes).values({
    ticketTypeId: typeIdMap.get(l.ticketTypeId!)!,
    key: l.key, label: l.label, inverseLabel: l.inverseLabel,
    directional: l.directional, position: l.position,
  }).returning();
  linkIdMap.set(l.id, n!.id);
}
const srcTargets = srcLinks.length
  ? await tx.select().from(linkTypeTargetTypes).where(inArray(linkTypeTargetTypes.linkTypeId, srcLinks.map((l) => l.id)))
  : [];
if (srcTargets.length) {
  await tx.insert(linkTypeTargetTypes).values(srcTargets.map((r) => ({
    linkTypeId: linkIdMap.get(r.linkTypeId)!,
    targetTypeId: typeIdMap.get(r.targetTypeId)!,
  })));
}
```
Delete the old `ticket_type_fields` clone block and the scheme-scoped field/link selects. Update imports (`linkTypeTargetTypes`; drop `ticketTypeFields`).

- [ ] **Step 4: Run — passes.**
Run: `pnpm --filter @tickets/api test clone-scheme`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add apps/api/src/schemes/clone-scheme.ts apps/api/src/schemes/clone-scheme.test.ts
git commit -m "feat(api): clone per-type fields, links, and target rows"
```

---

### Task 7: Fresh-DB integration verify

**Files:** none (verification only). Optionally add `packages/db/src/seed/verify-scheme.ts` assertions.

- [ ] **Step 1: Seed a fresh scheme + project end to end**
```bash
cd packages/db
POSTGRES_DATABASE=tozf_a1 pnpm exec tsx -e "
import {createDbClient} from './src/client';
import {ensureSoftwareScheme} from './src/seed/ensure-software-scheme';
import {seedProject} from './src/seed/seed-project';
const {db,sql}=createDbClient({max:1});
const {schemeId}=await ensureSoftwareScheme(db);
await seedProject(db,{key:'demo',name:'Demo',ticketPrefix:'DEMO',schemeId});
console.log('seeded scheme',schemeId); await sql.end();"
```
Expected: prints a scheme id, no error.

- [ ] **Step 2: Assert per-type ownership + no junction rows** via tsx probe:
```bash
POSTGRES_DATABASE=tozf_a1 pnpm exec tsx -e "
import {createDbClient} from './src/client';
import {fields,linkTypes,ticketTypeFields,ticketTypes} from './src/schema';
import {eq} from 'drizzle-orm';
const {db,sql}=createDbClient({max:1});
const t=(await db.select().from(ticketTypes)).length;
const f=(await db.select().from(fields)).length;
const nullType=(await db.select().from(fields)).filter(x=>x.ticketTypeId==null).length;
const ttf=(await db.select().from(ticketTypeFields)).length;
console.log(JSON.stringify({types:t,fields:f,fieldsWithoutType:nullType,ticketTypeFieldRows:ttf}));
await sql.end();"
```
Expected: `types:5`, `fields:` = sum of per-type fieldKeys (Epic 8 + Task 11 + Bug 12 + Subtask 6 + Spike 9 = **46**), `fieldsWithoutType:0`, `ticketTypeFieldRows:0`.

- [ ] **Step 3: Drop the scratch DB**
```bash
POSTGRES_DATABASE=postgres pnpm exec tsx -e "import {createDbClient} from './src/client'; const {sql}=createDbClient({max:1}); await sql\`DROP DATABASE IF EXISTS tozf_a1\`; await sql.end();"
```

- [ ] **Step 4: Full checks**
Run: `pnpm typecheck && pnpm --filter @tickets/db test && pnpm --filter @tickets/api test`
Expected: db + already-migrated api tests pass; the Plan B files are still red only if they were committed red — they were not (Task 5 left them untouched on disk; their consumers are edited in Plan B). If `pnpm typecheck` fails on the known Plan B consumers, that is expected and is the entry criterion for Plan B; note it and stop.

- [ ] **Step 5: Commit** (only if verify-scheme.ts changed)
```bash
git add packages/db/src/seed/verify-scheme.ts
git commit -m "test(db): assert per-type field/link ownership on fresh seed"
```

## Self-Review (author checklist, run after drafting)

- Spec coverage: schema (§1) → Tasks 1; seed (§4) → Tasks 2–4; vocab (§2) → Task 5; fork (§6) → Task 6. Migration (§5) and API/board (§2–3) are Plans C/B.
- Type consistency: `fieldIdByTypeKey`, `fieldByTypeKey`, `linkTypeTargets`, `TypeLinkDef` used consistently across tasks.
- Expand-only: no NOT NULL / DROP of `scheme_id` or `ticket_type_fields` in this plan — deferred to Plan C.
