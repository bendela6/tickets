# Configurable Views — Database Changes

**Date:** 2026-07-08 · Scope: all 8 epics (E0–E7) of the Configurable Views initiative.

## TL;DR

- **~Everything is a jsonb shape change inside existing columns** (`views.config`, `fields.config`) → **no migration**, validated in the app layer.
- **Exactly one required DDL migration:** make `views.project_id` **nullable** for global cross-project views (E7-T2).
- **One decision:** field **capability flags** in `fields.config` (jsonb, no DDL — *recommended*) vs. explicit boolean columns.
- **No new tables required** (an optional `view_projects` junction only if global views must scope to a *subset* of projects instead of all).

## Change matrix

| Table | Change | Kind | Epic/Task | Migration? |
|---|---|---|---|---|
| `views` | `project_id` → **nullable** (null = global, all-projects view) | **DDL** | E7-T2 | **Yes** |
| `views` | `config` jsonb carries grouping / swimlane+WIP / `sort[]` / AND-of-OR filters / column widths / cardLayout / kpis / modeConfig | jsonb shape | E1–E6 | No |
| `views` | *(optional)* `is_default boolean` to mark the protected default | DDL (optional) | E1 governance | Optional (skip) |
| `fields` | **capability flags** (groupable / dateRole / aggregatable) | jsonb in `config` *(recommended)* | E0-T5 | No |
| `fields` | `position` / `required` / `config.widget` edited from the UI | writes only | E0-T3 | No |
| `field_options` | per-type options created/reordered/archived | writes only | E0-T4 | No |
| — | KPI defs, card layout, calendar/timeline config, column widths | live in `views.config` | E2–E6 | No |
| — | draft → Save-to-view | client state | E1-T4 | No |

---

## 1. `views` — the only required DDL

Current schema (`packages/db/src/schema/views.ts`):
```ts
export const views = pgTable('views', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id),
  name: text('name').notNull(),
  config: jsonb('config').notNull().default(sql`'{}'::jsonb`),
  position: integer('position').notNull(),
  archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'string' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
});
```

### 1a. Nullable `project_id` (global views) — REQUIRED (E7-T2)
```ts
// change: drop .notNull()
projectId: integer('project_id').references(() => projects.id), // null = global (all projects)
```
```sql
ALTER TABLE views ALTER COLUMN project_id DROP NOT NULL;
```
- **null = cross-project "All tickets" view.** Board/route code must treat null as "load across all projects."
- Existing rows all have a non-null `project_id` → still valid after the column becomes nullable. Zero data migration.
- If global views must later scope to a *subset* of projects (not all), add a junction instead of relying on null:
  ```sql
  CREATE TABLE view_projects (
    view_id    integer NOT NULL REFERENCES views(id) ON DELETE CASCADE,
    project_id integer NOT NULL REFERENCES projects(id),
    PRIMARY KEY (view_id, project_id)
  );
  ```
  *(Deferred — not needed for the current "all 4 projects" behavior.)*

### 1b. (Optional) explicit default marker — RECOMMEND SKIP
"Default view is undeletable" can be enforced on the **first-by-`position`** view (the project index already redirects to it) — **no column needed**. Only if you want a movable, explicit default:
```sql
ALTER TABLE views ADD COLUMN is_default boolean NOT NULL DEFAULT false;
```

### 1c. `views.config` shape — NO DDL
`config` is already `jsonb NOT NULL DEFAULT '{}'`. It simply carries a richer shape, validated by `apps/api/src/views/validate-view-config.ts` — **not** the database. Target shape in §4.

---

## 2. `fields` — capability flags — NO DDL (recommended)

Fields already have a `config jsonb` column (where `widget` lives). Store the new flags there:
```jsonc
// fields.config
{
  "widget": "markdown",
  "groupable": true,            // eligible as kanban column / group-by / swimlane
  "dateRole": "due",           // "start" | "end" | "due" | null — calendar/timeline eligibility
  "aggregatable": true         // numeric field: allowed in rollups + KPI sum/avg
}
```
Defaults derive from field `type` until an admin sets them (select/status/user → `groupable`; date → date-eligible; number → `aggregatable`); the explicit flag overrides. The board payload surfaces the resolved flags (E1-T3); the field editor writes them (E0-T5).

**Alternative — explicit columns** (only if you want them queryable/typed at the DB):
```sql
ALTER TABLE fields ADD COLUMN groupable    boolean NOT NULL DEFAULT false;
ALTER TABLE fields ADD COLUMN date_role    text;                       -- 'start'|'end'|'due'|null
ALTER TABLE fields ADD COLUMN aggregatable boolean NOT NULL DEFAULT false;
```
**Recommendation: jsonb `config`** — consistent with `widget`, zero migration, and the app already reads `fields.config`.

---

## 3. No structural change

- **E0-T3** (reorder / required / widget), **E0-T4** (options): writes to existing `fields.position`, `fields.required`, `fields.config`, and `field_options`. No DDL.
- **E2** widths · **E2/E5/E6** grouping · **E3** swimlanes + WIP · **E4** KPIs · **E5/E6** modeConfig: all inside `views.config`. No DDL.
- **E1-T4** draft → Save: client-side state. No DDL.

---

## 4. Target `views.config` shape (jsonb — for reference, not a schema)

```ts
type ViewConfig = {
  columns: ViewColumn[];                       // meta (number|type|progress) + field; each { width?, hidden? }
  grouping: { fieldKey: string; collapsed?: string[] } | null;      // E2/E5
  swimlane: { fieldKey: string; wipLimits?: Record<string, number> } | null;   // E3
  sort: ViewSort[];                            // multi-level  (was a single object)
  filters: { op: 'and'; groups: { op: 'or'; rules: FilterRule[] }[] };  // AND-of-OR
  cardLayout: { fields: { fieldKey: string; render: 'chip'|'badge'|'text'|'avatar'|'progress' }[] } | null;  // E3
  kpis: KpiDef[] | null;                       // null → default 5-kind preset   // E4
  mode: 'table' | 'board' | 'calendar' | 'timeline';
  modeConfig: {
    calendar?: { dateFieldKey: string; chipFields: string[]; range: 'month' | 'week' };            // E5
    timeline?: { startFieldKey: string; endFieldKey: string; rowGroupKey?: string;
                 colorFieldKey?: string; zoom: 'week' | 'month' };                                  // E6
  };
  density: 'comfortable' | 'compact';
};

type KpiDef = {
  id: string; label: string;
  metric: 'count' | 'percent' | 'sum' | 'avg';
  fieldKey?: string;                           // for sum/avg, or the grouped field
  filter?: FilterRule[];                       // segment definition
  groupByFieldKey?: string;                    // e.g. one card per status kind
};
```

---

## 5. Migrations to generate

1. **`views.project_id` DROP NOT NULL** — one `drizzle-kit generate` migration. (E7-T2)
2. *(Only if you reject the jsonb approach)* `fields` capability columns. (E0-T5)
3. *(Deferred/optional)* `view_projects` junction; `views.is_default`.

Everything else is **expand-in-place jsonb** — no DDL, no `drizzle-kit generate`. Back-compat is handled in the app: `normalizeViewConfig` (E1-T1) upgrades old configs on read; the DB is untouched.
