# Items Platform — SP4a Phase 2: Full schema-management admin (API + UI)

**Status:** design of record for SP4a **Phase 2** of the items-platform rebuild.
**Branch base:** `items-platform` @ `27887d0` (SP1–SP3 + SP4a Phase 1 complete).
**Predecessors:** SP4a Phase 1 (web working-UI port). Phase 1 deleted the old settings
screens (git-preserved at `dab1e97`); this rebuilds admin against the new model.
**Siblings (own specs):** SP4b (MCP port) · SP4c (production cutover).

## 1. Goal

Give the web app a complete schema-management admin: create/edit **item types** and
their nesting rules, manage the scheme **field library** and per-type **placements**,
edit **options** (lifecycle kinds + colours) and the **workflow transition graph**, and
manage **link types** and their targets. Delivered full-stack: extend the `apps/api`
command/event core with the config commands the admin needs, then build the admin UI on
top. Built as **one combined spec + plan** (API commands and UI together).

## 2. Scope

**In scope:** the new API config commands below (types, placements, link-type
edit/targets, option-set auto-create) with typed events + `tickets_test` tests; a
restored `/settings` route in `apps/web` with a tabbed admin (Types · Fields · Workflow ·
Links) writing through the command envelope; a "Fork scheme for this project" action.

**Out of scope:** MCP (SP4b); production cutover/deploy (SP4c); scheme *creation* from
scratch (only `scheme.fork` from the seeded scheme); hard-deleting referenced entities
(archive only); bulk import/export of a scheme; field *type* changes after creation
(a field's `type` is immutable — create a new field instead).

## 3. Locked decisions

| # | Decision | Why |
|---|----------|-----|
| 1 | **Full-stack, one combined spec + plan** (API commands + admin UI). | The UI's needs define exactly which commands to add — designing them together avoids unused commands (YAGNI). |
| 2 | **Archive (soft), never hard-delete, for referenced entities** — types, fields, options, link types set `archivedAt`. **Hard-delete/replace** for graph/join rows — transitions, `item_type_child_types`, `link_type_target_types`. | Items and history reference types/fields/options/links; archiving hides them from pickers while preserving values. Graph/join rows are not referenced by items, so they're safe to remove. |
| 3 | **`field.create` auto-creates an option set** when `type === 'option'` and no `optionSetId` is given. | A brand-new option field is immediately usable; the user then adds options to it — no separate "create option set" concept in the UI. |
| 4 | **Admin edits the project's current (shared) scheme directly;** a **"Fork scheme for this project"** action (`scheme.fork`) is offered for when a project must diverge. | Matches the single-scheme reality; forking is an explicit, visible choice rather than implicit copy-on-write. |
| 5 | **The API extensions are additive** — new commands/events/routes only, no change to existing command behaviour; the admin UI is new screens. | The package stays green throughout (unlike Phase 1's coordinated migration); gate per-package per task. |
| 6 | **Every admin action is a typed command through the envelope** (`commandId`+`actorId`), like every other mutation. | Consistency; config changes get event history (SP2 decision 6). |

## 4. New API commands (apps/api)

Follow the existing `defineCommand`/`defineEvent`/`runCommand` pattern (`command/config/*`).
Each command emits a typed event and is exercised against `tickets_test`.

### 4.1 Types
- **`type.create`** — input `{ schemeId, key, label, config?: {color?} }`. Inserts an
  `item_types` row at the next `position`. Emits `type.created`.
- **`type.update`** — input `{ id, label?, config?, archived? }`. Updates label/config;
  `archived: true` sets `archivedAt = now()`, `false` clears it. Emits `type.updated`.
- **`type.setChildTypes`** — input `{ typeId, childTypeIds: number[] }`. Replaces the
  `item_type_child_types` rows for `typeId` with the given set (delete-all-then-insert in
  one txn). Emits `type.child_types_set`.

### 4.2 Field placements
- **`field.place`** — input `{ itemTypeId, fieldId, position?, required?, configOverride? }`.
  Inserts an `item_type_fields` row placing an EXISTING library field on a type (at the
  next position if unspecified). Rejects a duplicate placement (409/422). Emits `field.placed`.
- **`field.unplace`** — input `{ itemTypeId, fieldId }`. Deletes the `item_type_fields`
  row. (The library field itself is untouched — archive the field via `field.update` to
  retire it everywhere.) Emits `field.unplaced`.
- **`placement.update`** — input `{ itemTypeId, fieldId, required?, position?, allowedOptionIds? }`.
  Updates the placement's `required`/`position` and `configOverride.allowedOptionIds`.
  Emits `placement.updated`.

### 4.3 Option sets
- **`field.create`** (extended) — when `type === 'option'` and `optionSetId` is absent,
  create a fresh `option_sets` row (scheme-scoped, derived key) and use its id. Existing
  behaviour (given an `optionSetId`) unchanged. The emitted `field.created` payload gains
  the resolved `optionSetId`.

### 4.4 Link types
- **`linkType.update`** — input `{ id, label?, inverseLabel?, directional?, archived? }`.
  Emits `linkType.updated`.
- **`linkType.setTargetTypes`** — input `{ linkTypeId, targetTypeIds: number[] }`. Replaces
  the `link_type_target_types` rows. Emits `linkType.target_types_set`.

### 4.5 Reused as-is (no change)
`field.create`/`field.update`, `option.create`/`option.update` (archive via `archived`),
`transition.create`/`transition.delete`, `linkType.create`, `scheme.fork`.

### 4.6 Routes
New routes in `apps/api/src/routes/schemes.routes.ts` (the config route module):
`POST /api/types` (type.create), `PATCH /api/types/:id` (type.update),
`PUT /api/types/:id/child-types` (type.setChildTypes),
`POST /api/types/:typeId/fields/:fieldId/placement` (field.place),
`DELETE /api/types/:typeId/fields/:fieldId/placement` (field.unplace),
`PATCH /api/types/:typeId/fields/:fieldId/placement` (placement.update),
`PATCH /api/link-types/:id` (linkType.update),
`PUT /api/link-types/:id/target-types` (linkType.setTargetTypes).
All parse the envelope + dispatch to the command.

## 5. Admin UI (apps/web)

Restore the `/settings` route + the nav gear removed in Phase 1 (`app-shell.tsx`,
`router.ts`, a new `settings-route.tsx`). A tabbed `settings-screen.tsx` reads all
vocabulary from the existing board query (`useBoard` → types/fields/placements/options/
transitions/linkTypes) and writes through new command hooks, each via `apiMutate`
(envelope). Rebuild against the new model, reusing Instrument components and the
git-preserved old screens (`@ dab1e97`) as layout reference. Prototype:
the mockup approved during design (`sp4a-p2-admin-mockup`).

- **Types tab** — list types (colour + key); create/edit/archive (label, colour); edit
  allowed child types (chip add/remove → `type.setChildTypes`).
- **Fields tab** — the scheme field library + a per-type **placement editor**: create a
  field (`field.create`, auto option set for option fields), place an existing field
  (`field.place`), unplace (`field.unplace`), reorder + toggle required + set the per-type
  option allowlist (`placement.update`). Archive a library field via `field.update`.
- **Workflow tab** — per type, the status field's options (add via `option.create`; edit
  label/kind/colour/archive via `option.update`) and the transition graph (add/remove
  from→to edges via `transition.create`/`transition.delete`, incl. guard config).
- **Links tab** — link types (create/edit/archive via `linkType.create`/`update`) and
  their target types (`linkType.setTargetTypes`).
- **Scheme banner** — shows "editing the shared *<scheme>* — affects N projects" with a
  **Fork for this project** action (`scheme.fork`, then repoint the project's `schemeId`).

New web hooks (all through `apiMutate`): `useCreateType`, `useUpdateType`,
`useSetChildTypes`, `useCreateField`, `usePlaceField`, `useUnplaceField`,
`useUpdatePlacement`, `useCreateOption`, `useUpdateOption`, `useCreateTransition`,
`useDeleteTransition`, `useCreateLinkType`, `useUpdateLinkType`, `useSetTargetTypes`,
`useForkScheme`. Each invalidates the `['board']` query on success.

**Client type fix:** add `position: number` to the client `ItemType` (Phase 1 omitted it —
the admin and board order types by it).

## 6. Gate (additive — package stays green)

- API commands are additive → `@tickets/api` typecheck + test stay green each task.
- Admin UI is new screens → `@tickets/web` typecheck + test + build stay green each task.
- No coordinated red window (unlike Phase 1). Root `pnpm typecheck` remains 5/5.

## 7. Testing

- **API** (`tickets_test`, harness forces it, `fileParallelism:false`): per command, a
  round-trip integration test (create/update/archive/place/unplace/setChildTypes/
  setTargetTypes/fork) that reloads the scheme vocab and asserts the resulting rows +
  the emitted event; **corruption probes** for the replace-set commands (setChildTypes/
  setTargetTypes must replace, not append or wipe unrelated rows) and archive (archiving a
  field keeps existing `item_values`). Never touch `tickets`/`tickets_dev`/`tickets_platform`.
- **Web** (vitest + jsdom, mocked fetch): per admin tab, a component test asserting the
  command hook fires the right route + envelope body (destructure the random `commandId`),
  and that archived entities are filtered from pickers.

## 8. Deferrals

| Deferred | To |
|----------|-----|
| MCP admin/tools | SP4b |
| Production deploy of the admin | SP4c |
| Scheme create-from-scratch, import/export | later, if needed |
| Changing a field's `type` after creation | out of scope (create a new field) |

## Types

```ts
// New command inputs (apps/api/src/command/config/*). valibot schemas mirror these.
interface TypeCreateInput { schemeId: number; key: string; label: string; config?: { color?: string } }
interface TypeUpdateInput { id: number; label?: string; config?: Record<string, unknown>; archived?: boolean }
interface TypeSetChildTypesInput { typeId: number; childTypeIds: number[] }

interface FieldPlaceInput { itemTypeId: number; fieldId: number; position?: number; required?: boolean; configOverride?: { allowedOptionIds?: number[] } | null }
interface FieldUnplaceInput { itemTypeId: number; fieldId: number }
interface PlacementUpdateInput { itemTypeId: number; fieldId: number; required?: boolean; position?: number; allowedOptionIds?: number[] }

interface LinkTypeUpdateInput { id: number; label?: string; inverseLabel?: string; directional?: boolean; archived?: boolean }
interface LinkTypeSetTargetTypesInput { linkTypeId: number; targetTypeIds: number[] }

// Existing, reused (apps/api/src/command/config): FieldCreateInput (now resolves/creates
// an optionSetId when type==='option' && optionSetId is absent), FieldUpdateInput,
// OptionCreateInput, OptionUpdateInput, TransitionCreateInput, TransitionDeleteInput,
// LinkTypeCreateInput, SchemeForkInput.

// New event kinds (aggregateType 'type' | 'field' | 'linkType' | 'scheme' as fits):
// type.created, type.updated, type.child_types_set,
// field.placed, field.unplaced, placement.updated,
// linkType.updated, linkType.target_types_set.
// (field.created payload gains optionSetId.)

// Affected DB tables (existing; no schema change — archivedAt already present on
// item_types, fields, options, link_types):
//   item_types { id, schemeId, key, label, position, config: {color?}, archivedAt }
//   item_type_fields (placement) { itemTypeId, fieldId, position, required, configOverride: {allowedOptionIds?}|null }
//   item_type_child_types { parentTypeId, childTypeId }        // PK(parentTypeId, childTypeId)
//   option_sets { id, schemeId, key, name }                    // auto-created by field.create for option fields
//   options { id, optionSetId, value, label, position, kind, config, archivedAt }
//   link_types { id, itemTypeId, key, label, inverseLabel, directional, position, archivedAt }
//   link_type_target_types { linkTypeId, targetTypeId }        // PK(linkTypeId, targetTypeId)

// Client vocab addition (apps/web/src/api/types.ts): ItemType gains `position: number`.

// New web hooks (apps/web/src/api/): each = a react-query mutation through apiMutate,
// invalidating ['board']. See §5 for the list.
```

## Related

`items-platform-rebuild` memory · SP4a Phase 1 spec `2026-07-16-sp4a-web-working-ui-port-design.md`
· config command pattern `apps/api/src/command/config/*` · prototype mockup `sp4a-p2-admin-mockup`.
