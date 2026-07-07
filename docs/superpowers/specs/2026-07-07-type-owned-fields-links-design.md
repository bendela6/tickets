# Type-owned Fields & Links — Design

**Date:** 2026-07-07 · **Branch:** `redesign` · **Status:** approved, ready to plan

## Goal

Make a **ticket Type** the single owner of everything that describes its tickets: its **statuses** (already type-owned), its **fields** (+ options), and its outgoing **link types** (+ allowed target types). The **Scheme** shrinks to a forkable bundle of types.

## Motivation & current state

Today, config lives at two levels:

- `statuses.ticket_type_id` — **type-owned** already.
- `fields.scheme_id` — **scheme-owned**; a type opts in via the `ticket_type_fields` junction (which carries per-type `position` + `required`). So `severity` is one shared row attached only to Bug.
- `link_types.scheme_id` — **scheme-owned** and **not tied to any type**; any link type can connect any two tickets.

The user wants fields and links to live **under types**, the way statuses do. After brainstorming, three decisions are locked:

1. **Fields — full type-ownership.** Each type owns its own field rows and option lists. Bug's `priority` is a *different* row from Task's `priority`. No shared universal fields.
2. **Links — source-type owns them, with allowed targets.** Each type owns its outgoing link types; each link type declares which target types are valid; link creation is guarded against it.
3. **Scope — backend + board-read this pass.** DB schema, seed, API (per-type CRUD + link guardrails), migration of live data, and the board/views read-path (so boards keep working). The settings/management UI is deferred to a later pass.

## Consequences accepted

- Universal fields (`title`, `description`, `status`, `priority`, `assignee`, `labels`, …) duplicate as separate rows per type. Editing one type's options never touches another's.
- **Every board is multi-type**, so a column can no longer point at a single field id — columns resolve by field **key** per row (§ Board resolution). This is the same mechanism the `status` column already uses.
- The `priority`/`assignee`/`kind` backfill done on 2026-07-07 is preserved: migration remaps those values onto the new per-type field rows.

## Architecture

### 1. Schema changes

**`fields`** (scheme-owned → type-owned):
- Replace `scheme_id` with `ticket_type_id NOT NULL REFERENCES ticket_types(id)`.
- Add `position INT NOT NULL` and `required BOOLEAN NOT NULL DEFAULT false` (absorbed from `ticket_type_fields`).
- Unique `(ticket_type_id, key)`.
- Keep `key, label, type, system, config, archived_at, created_at`.

**`ticket_type_fields`** — **dropped.** A type's fields become `fields WHERE ticket_type_id = T ORDER BY position`.

**`field_options`** — no schema change; options now duplicate per type-field.

**`link_types`** (scheme-owned → type-owned as source):
- Replace `scheme_id` with `ticket_type_id NOT NULL REFERENCES ticket_types(id)` (the owning/source type).
- Unique `(ticket_type_id, key)`.
- Keep `key, label, inverse_label, directional, position, archived_at`.

**`link_type_target_types`** — **new** junction: `(link_type_id → link_types, target_type_id → ticket_types)`, PK `(link_type_id, target_type_id)`. FK-checked valid targets (not JSON).

**`ticket_types`** — unchanged (still `scheme_id`). Scheme now owns *only* types.

**`statuses`, `ticket_values`, `ticket_links`** — no structural change; values/links point at the new per-type rows after migration.

**`views`** — `config` field columns/sort reference field **`key`** instead of field **`id`** (§ Board resolution). Existing configs rewritten by the migration.

System fields (`title`/`description`/`status`) also become per-type rows — consistent with the model. `status` remains a proxy field: its column identity resolves by key, but its value still comes from `ticket_values.status_id` → per-type `statuses`.

### 2. Vocab & board resolution (the load-bearing change)

`loadProjectVocab` gains (analogous to the existing `statusByTypeKey`):
- `fieldByTypeKey: Map<"${typeId}:${key}", Field>` — per-type field lookup.
- `fieldsByType: Map<number, Field[]>` — a type's fields, ordered by `position`.
- `fieldKeys: LogicalField[]` — distinct non-archived field keys across the scheme's types, each with a representative `{ key, label, type }`. Drives view-column validation and the column palette.
- `linkTypesByType: Map<number, LinkType[]>` and `linkTypeTargets: Map<number, Set<number>>` (link_type_id → allowed target type ids).
- keep `fieldById` for direct id lookups on the write path.

**Board render:** a `{ source: 'field', fieldKey }` column resolves per row via `fieldByTypeKey.get(typeId + ':' + fieldKey)`; empty cell if the row's type lacks the key. **Sort** on a shared select column orders by the option `position` of each row's per-type field — the seed keeps universal fields' option lists identical across types, so positions line up.

**`validate-view-config`:** a field column/sort is valid iff its `fieldKey` is in `vocab.fieldKeys`.

Rejected alternative: a first-class `logical_fields` table at scheme level to canonicalize shared columns. It re-adds a scheme-level concept and fights "everything under types"; plain key-matching is simpler and sufficient.

### 3. Write path & API (per-type CRUD)

- **Fields:** `POST /api/types/:typeId/fields` (owned by the type; no more scheme scope + `attach[]`). `PATCH /api/fields/:id` and option routes unchanged. Optional `POST /api/types/:typeId/fields/clone-from/:fieldId` to copy a field + options onto another type.
- **Statuses:** already per-type — unchanged.
- **Links:** `POST /api/types/:typeId/link-types` with `targetTypeKeys[]` (creates the link type + target rows). `PATCH /api/link-types/:id` (label/inverse/archived/targets). **Link creation guard:** the chosen link type must be owned by the source ticket's type, and the target ticket's type must be in the link type's allowed targets — else 422. Mirrors the existing `checkParent`/`checkGuard` enforcement.
- **Writing values:** resolve the field by `(ticket.typeId, key) → id` so a Task's `priority` write always lands on Task's `priority` field.

### 4. Seed rework

`SOFTWARE_SCHEME` defines fields **per type** (universal fields spread into each type's list from one source template to keep the seed DRY, but they materialize as separate rows). Link types are defined per source type with `allowedTargets`. The default-view blueprint uses field **keys**. `seedScheme` inserts types → per-type fields+options → per-type statuses (already) → per-type link types + targets; no `ticket_type_fields`.

### 5. Migration — in-place expand/migrate/contract (561 live tickets)

In-place derivation (does **not** touch statuses, which are already per-type):

1. **Expand:** add nullable `fields.ticket_type_id/position/required`, `link_types.ticket_type_id`, and the `link_type_target_types` table.
2. **Migrate:**
   - For each `(type T, attached field F)` in `ticket_type_fields`: create per-type field `F_T` (copy `key/label/type/system/config`, `position/required` from the junction) owned by `T`; duplicate `F`'s options into `F_T`. Build `map(T, key) → F_T.id`.
   - Remap every `ticket_value`: for a value on a ticket of type `T` whose current field has key `k`, set `field_id = map(T, k)`.
   - Link types: for each shared link type `L` and each distinct source type `S` observed on `ticket_links` using `L`, create `L_S` owned by `S`; seed its allowed targets from the distinct **observed** target types (trim later via API). Remap `ticket_links.link_type_id → L_S` by source ticket type. Unused link types are copied onto every type with all-types targets so vocabulary is preserved.
   - Views: rewrite `config` field columns/sort from field **id** → field **key**.
3. **Contract:** drop `fields.scheme_id`, `link_types.scheme_id`, drop `ticket_type_fields`; set new columns `NOT NULL`; swap uniques to `(ticket_type_id, key)`.

**Verify (all-zero):** every `ticket_value.field_id` → a field whose `ticket_type_id` equals the value's ticket type; every `ticket_link.link_type_id` → a link type owned by the source ticket's type with the target type allowed; every view `fieldKey` resolves to ≥1 type field; total value/link counts unchanged.

**Promotion:** validate on a dev copy, then promote to the live docker DB via the dump-copy-migrate-contract-swap-back playbook and rebuild the api image — same as the prior scheme migration.

### 6. Fork

`cloneScheme` clones per-type fields + options, per-type link types, and remaps the `link_type_target_types` rows onto the cloned types. `remapClonedRows` extended for the new FKs.

## Decomposition → three sequenced plans

Each produces working, tested software on its own.

- **Plan A — Foundation:** schema (type-owned fields/links, drop junction, target table), seed rework, `loadProjectVocab` key maps, `cloneScheme`. Verified on a fresh dev DB (seed + unit tests).
- **Plan B — Read/write + API:** board/views key resolution, `validate-view-config`, value-write key resolution, per-type field/link CRUD routes, link-creation guardrails. Vitest + Fastify `inject` probes.
- **Plan C — Migration + promotion:** expand/migrate/contract scripts, dev-copy verify, promote to live docker, rebuild api, merge.

Plan files: `docs/superpowers/plans/2026-07-07-type-owned-foundation.md`, `-type-owned-readwrite-api.md`, `-type-owned-migration.md`.

## Types

```ts
// fields (Drizzle shape, post-change)
type Field = {
  id: number;
  ticketTypeId: number;          // was schemeId
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'json' | 'select' | 'multi_select';
  system: boolean;
  required: boolean;             // absorbed from ticket_type_fields
  position: number;              // absorbed from ticket_type_fields
  config: Record<string, unknown>;
  archivedAt: string | null;
  createdAt: string;
};

// link_types (Drizzle shape, post-change)
type LinkType = {
  id: number;
  ticketTypeId: number;          // was schemeId; the owning/source type
  key: string;
  label: string;
  inverseLabel: string;
  directional: boolean;
  position: number;
  archivedAt: string | null;
};

// link_type_target_types (new junction)
type LinkTypeTargetType = { linkTypeId: number; targetTypeId: number };

// view config column/sort (fieldId → fieldKey)
type ViewColumn =
  | { source: 'number' | 'type' | 'progress' }
  | { source: 'field'; fieldKey: string; width?: number; hidden?: boolean };
type ViewSort = { source: 'field'; fieldKey: string; dir: 'asc' | 'desc' };

// logical field — a distinct key across the scheme's types, for column validation/palette
type LogicalField = { key: string; label: string; type: Field['type'] };
```

## Out of scope (this pass)

- Settings/management UI for creating/editing per-type fields, options, and links.
- Keeping universal-field option lists in sync across types (they are independent by design; a later "apply to types" convenience may help).
- Re-typing migrated defect Tasks as Bug / adding a `fix` kind (tracked separately).
