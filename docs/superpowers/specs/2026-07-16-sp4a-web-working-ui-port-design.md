# Items Platform — SP4a Phase 1: Web working-UI port (type-aware, deployable)

**Status:** design of record for SP4, slice **a / phase 1** of the items-platform rebuild.
**Branch base:** `items-platform` @ `de066df` (SP1 + SP2 + SP3 complete).
**Predecessors:** SP1 (schema+import), SP2 (API command-path), SP3 (event runtime).
**Siblings (own specs, later):** SP4a **Phase 2** = schema-management admin UI · SP4b = MCP port · SP4c = production cutover + deploy + merge to `main`.

## 1. Goal

Port the redesigned **Instrument** web app's *working* screens (board/table, create, item detail, comments, links, views, home/stats) off the old ticket API and onto the new **items** API, surfacing the type/option model. The deliverable is a **deployable, model-aware web app running on the new schema** — the artifact SP4c cuts production over to. The app currently 404s against the new API because it calls the old ticket routes and the removed `statuses`/`status-transitions` vocabulary.

## 2. Scope

**In scope (Phase 1):**
- Reweave the `apps/web/src/api/` hook layer onto the new routes, with the command envelope (`commandId`+`actorId`) on every mutation.
- Derive all project vocabulary (types, placed fields, options+kinds, transitions, link types, views, users) from the **board** response instead of the removed per-resource vocab endpoints.
- Make the working screens **type-aware**: choose a type on create; render a type's placed fields; drive the status control from the type's allowed option subset with lifecycle-kind coloring and transition enforcement.
- Adopt terminology: show specific **type names** (Task, Bug, Epic, Spike, Subtask); use generic **"item"** where the UI said "ticket".
- Update the existing vitest component tests + add type-aware coverage.

**Out of scope (siblings):** editable schema administration — types, field placements, option sets, transitions (SP4a **Phase 2**); MCP (SP4b); production data migration, deploy, and `main` merge (SP4c). The Phase-1 app is deployable without the admin UI: schema is edited via API/seed until Phase 2.

## 3. Locked decisions

| # | Decision | Why |
|---|----------|-----|
| 1 | **Port depth: surface the new model** (types, per-type placements, option-based workflow with kinds) in the working screens. | The rebuild's point is the new model; the UI should reflect it, not hide it behind a ticket veneer. |
| 2 | **Phased: Phase 1 (working UI) is deployable on its own**; schema admin is Phase 2. | Reaches production soonest; the rarely-used admin does not block the SP4c cutover. |
| 3 | **The board response is the single vocab+items source.** `GET /api/projects/:key/board` returns `{project, types, fields, placements, options, transitions, linkTypes, views, users, items}` in one call. | Removes N vocab round-trips; the removed `/statuses` `/status-transitions` `/fields` endpoints have no replacement to call. |
| 4 | **One envelope wrapper injects `commandId`+`actorId`** into every mutating request body. | DRY; every write now needs the envelope, and forgetting it is a 400. |
| 5 | **Terminology: type names + generic "item"**, dropping "ticket" from the UI copy. | Matches the model the user chose to surface. |
| 6 | **Verify against the running new API on `tickets_platform`** (real 635 items, SP3 worker live), never production `tickets`. | Real-data verification without touching prod; `tickets_platform` is the SP4c source. |

## 4. Architecture

```
GET /api/projects/:key/board  ──►  useBoard()  ──►  useProjectVocab() selector
  {project,types,fields,placements,          derives: typeById, fieldsForType(typeId),
   options,transitions,linkTypes,                    statusOptionsFor(typeId) (+kind),
   views,users,items}                                allowedTransitions(typeId,from)

mutations ──► apiMutate(path,{method,body}) ──► fetchJson  (injects commandId+actorId)
```

### 4.1 Data layer — hook reweave

`fetchJson` (`apps/web/src/api/client.ts`) is unchanged. Add `apiMutate<T>(path, { method, body })` that merges `{ commandId: crypto.randomUUID(), actorId }` (actor from `useCurrentUser()`) into `body` and calls `fetchJson`. Every mutation hook routes through it.

Route + shape changes (old → new), all mutations gaining the envelope:

| Hook | Old | New |
|------|-----|-----|
| `use-board` | `GET /api/projects/:key/board` | same route, **new response shape** (§4.2) |
| `use-create-ticket` → `use-create-item` | `POST /api/projects/:key/tickets` | `POST /api/projects/:key/items` (body: `typeKey`, `values`, envelope) |
| `use-patch-ticket` → `use-patch-item` | `PATCH /api/tickets/:id` | `PATCH /api/items/:id` (body: `expectedUpdatedAt`, `parentId?`, `archived?`, `values`, envelope) |
| `use-create-comment` | `POST /api/tickets/:id/comments` | `POST /api/items/:id/comments` (+envelope) |
| `use-ticket-events` → `use-item-activity` | `GET /api/tickets/:id/events` | `GET /api/items/:id/activity` (SP3 feed) with `/api/items/:id/events` as the raw-stream fallback |
| `use-create-link` | `POST /api/links` | same (+envelope in body) |
| `use-delete-link` | `DELETE /api/links/:id?actorId=` | `DELETE /api/links/:id` (**envelope in body**, not query) |
| `use-create-view` / `use-patch-view` | `/api/projects/:key/views`, `/api/views/:id` | same (+envelope) |
| `use-create-project` / `use-create-user` | `/api/projects`, `/api/users` | same (+envelope) |
| `use-vocab-workflow`, `use-vocab-fields` | `/api/projects/:key/statuses`, `/status-transitions`, `/fields` | **deleted** — replaced by `useProjectVocab()` over the board payload |

### 4.2 Model mapping (old ticket UI → new items model)

- **ticket → item**: `{ id, number, typeId, parentId, values: Record<fieldKey, rendered>, comments, links, archivedAt, createdAt, updatedAt }` (the board's `items[]`; see `AssembledItem`).
- **status → the type's workflow option field.** A status *value* is an option `value` string; its lifecycle color comes from `Option.kind` (`todo|active|blocked|done|dropped`). The board groups by the type's allowed status options; "done/active" rollups use `kind`.
- **fields shown for an item** = its type's placements (`ItemTypeField[]` for `item.typeId`), option fields narrowed by `configOverride.allowedOptionIds`.
- **assignee** → the `user`-typed field; value is a user id (rendered as `{id,name}` in `values`).

### 4.3 Type-aware screens

- **Create dialog** (`new-ticket-dialog` → `new-item-dialog`): first choose a **type** (name + `config.color`); the form renders that type's placed fields (required first); the status field defaults to the type's initial option (lowest-position `todo`, else lowest). Submits `typeKey` + `values` to `POST /api/projects/:key/items`.
- **Item detail drawer** (`ticket-drawer` → `item-drawer`): render the item's placed fields; the **status control** lists the type's allowed options with kind coloring and **disables options not reachable** from the current one per the transition graph (and surfaces a 422 message if the server rejects). Comments + the **SP3 activity feed** (`/api/items/:id/activity`). Links via link types for the item's type.
  - **Transition-graph data dependency (important).** `checkTransition` treats a *non-empty* edge set for a (field,type) as restrictive and an *empty* set as unrestricted. The current seed installs **entry-only** edges, so status is near-immutable — the UI would disable almost every move. The UI rule must be: **an empty allowed-set for the current option means "all options allowed"** (mirror the server), so it degrades to unrestricted exactly where the server does. Making status genuinely governed is a **data** task (install real workflow graphs, or clear transitions) owned by SP4c/data-curation before cutover — not Phase-1 code. Verification on `tickets_platform` should either clear the status transitions or accept that only entry moves are enabled.
- **Board / table / all-items**: status buckets/columns from options (kind drives column tint + progress); each row shows its **type badge**; type-aware field columns via `useProjectVocab`.
- **Home / project stats**: recompute "open/active/done" over `items` + `options.kind` instead of the old status strings.

### 4.4 Terminology

Replace "ticket" in visible copy with "item" (generic) and the specific type name on records ("New item" → type picker → a Task/Bug/… badge). Keep internal query keys stable where churn is pointless (e.g. the `['board']` react-query key), but rename user-facing hook/file names where it aids clarity (`use-create-ticket` → `use-create-item`).

## 5. Testing & verification

- **Component tests (vitest + jsdom):** update the existing suites — `kanban-view.test`, `new-ticket-dialog.test`, `ticket-drawer.test`, `workflow-settings.test` — to the new board shape and new routes/mocks. Add coverage for the new behavior: type picker drives the field set; status control colors by kind and disables illegal transitions; the envelope (`commandId`+`actorId`) is present on a representative mutation.
- **Gate:** `pnpm --filter @tickets/web test` + `pnpm --filter @tickets/web typecheck` + `pnpm build` (web). Root typecheck is already clean; keep it clean.
- **Manual/devtools verification** against the API run locally on **`tickets_platform`** (`POSTGRES_DATABASE=tickets_platform`, API + SP3 worker up): board loads real items, create/edit/comment/link succeed, the activity feed populates as the worker drains, illegal status moves are blocked. Never point verification at production `tickets`.

## 6. Deferrals

| Deferred | To |
|----------|-----|
| Editable schema admin (types, placements, option sets + kinds, transitions) | SP4a **Phase 2** |
| MCP tool reweave | SP4b |
| Production migration, deploy to `:4610`, merge `items-platform` → `main` | SP4c |
| Any brand-new screens beyond current parity + type-awareness | out of scope (YAGNI) |

## Types

```ts
// The board payload — the app's single source of vocabulary + items.
// Mirrors apps/api/src/read/board.ts `Board`.
interface Board {
  project: Project;
  types: ItemType[];
  fields: Field[];
  placements: ItemTypeField[];
  options: Option[];
  transitions: Transition[];
  linkTypes: LinkType[];
  views: View[];
  users: User[];
  items: Item[];
}

interface Project { id: number; key: string; name: string; schemeId: number; /* + display fields */ }

interface ItemType { id: number; key: string; label: string; schemeId: number;
  config: { color?: string } & Record<string, unknown>; archivedAt: string | null; }

interface Field { id: number; schemeId: number; key: string; label: string;
  type: 'string'|'number'|'boolean'|'date'|'datetime'|'option'|'user'|'json';
  config: { multiple?: boolean; workflow?: boolean; format?: string } & Record<string, unknown>;
  optionSetId: number | null; archivedAt: string | null; }

// A field placed on a type (with per-type overrides).
interface ItemTypeField { itemTypeId: number; fieldId: number; position: number; required: boolean;
  configOverride: { allowedOptionIds?: number[] } | null; }

interface Option { id: number; optionSetId: number; value: string; label: string; position: number;
  kind: 'todo'|'active'|'blocked'|'done'|'dropped' | null; // null for non-workflow options
  config: { color?: string; icon?: string } & Record<string, unknown>; archivedAt: string | null; }

interface Transition { id: number; fieldId: number; itemTypeId: number | null;
  fromOptionId: number | null; toOptionId: number; config: { guard?: { requiresComment?: boolean; requiresField?: string } } | null; }

interface LinkType { id: number; itemTypeId: number; key: string; label: string;
  inverseLabel: string; directional: boolean; }

interface View { id: number; projectId: number; name: string; config: Record<string, unknown>; }
interface User { id: number; name: string; kind: 'human'|'agent'; email: string | null; }

// One assembled item (mirrors apps/api/src/read/assemble-items.ts `AssembledItem`).
interface Item {
  id: number; number: number; typeId: number; parentId: number | null;
  createdBy: number; archivedAt: string | null; createdAt: string; updatedAt: string;
  values: Record<string, unknown>;           // fieldKey -> rendered value (option string, {id,name}, scalar, or array)
  comments: Comment[]; links: ItemLink[];
}
interface Comment { id: number; itemId: number; authorId: number; parentId: number | null; body: string; createdAt: string; }
interface ItemLink { id: number; linkTypeId: number; sourceItemId: number; targetItemId: number; createdAt: string; }

// SP3 activity feed entry (GET /api/items/:id/activity).
interface ActivityEntry { id: number; itemId: number; eventId: number; kind: string;
  actorId: number; at: string; correlationId: string; summary: Record<string, unknown>; }

// The command envelope every mutation body carries.
interface CommandEnvelope { commandId: string /* uuid */; actorId: number; }

// Derived client-side vocabulary selector over Board.
interface ProjectVocab {
  typeById: Map<number, ItemType>;
  fieldsForType(typeId: number): Field[];                    // via placements, ordered
  statusField(typeId: number): Field | undefined;           // config.workflow === true
  statusOptionsFor(typeId: number): Option[];               // allowed subset, with kind
  initialOption(typeId: number): Option | undefined;
  allowedTransitions(typeId: number, fromOptionId: number | null): Set<number>; // toOptionIds; empty set = unrestricted
}
```

## Related

`items-platform-rebuild` memory · SP3 spec `2026-07-16-items-platform-event-runtime-design.md` · new read shape `apps/api/src/read/board.ts` (`Board`), `apps/api/src/read/assemble-items.ts` (`AssembledItem`).
