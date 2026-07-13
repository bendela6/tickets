# EER model editor + edge-overlap fix — design

**Date:** 2026-07-13 · **App:** `apps/eer` · **Status:** approved (this doc is the spec of record)

Two workstreams in one spec. **B is built first** (small, test-first, independent); **A** then
provides the interactive playground to construct more routing cases.

| # | Workstream | Outcome |
|---|------------|---------|
| B | Edge-overlap ("line sorting") fix | Edges from one node to N nodes never draw on top of each other |
| A | Model editor | Create/select/save/delete models; CRUD groups, subgroups, tables; auto connections; modal editing |

---

## B — Edge-overlap fix

**Symptom.** A hub table connected to several tables produces edges that run on top of each
other along shared corridors ("avoid"/"ortho" modes).

**Approach (test-first).** Reproduce as a failing unit test before touching code: a hub entity
with edges to 3 stacked entities, positioned so all three routes share a corridor. Assert the
invariant: *no two routed edges share an overlapping collinear segment* — excluding the pin fan
at a shared port, where slot offsets separate the lines by design.

**Known suspects** (to be confirmed by evidence, not assumed):

- `separateAxis` lane allocation's *stay-put fallback* ("every lane taken or blocked — stay put")
  leaves two runs on the same lane instead of escalating the search.
- The 2026-07-13 `shrinksPortStub` guard forbids lanes toward a card near port corridors, making
  the stay-put fallback more likely exactly where fan-outs bundle.
- `orderChannels` reorders lanes within a channel but never *adds* lanes, so it cannot repair an
  allocation shortfall.

**Deliverables.**

1. Failing repro test in `compute-routes.test.ts` (hub → 3 case) + a general overlap-invariant
   assertion reusable across fixtures.
2. Fix at the layer the evidence identifies (lane allocation escalation is the expected site).
3. Live verification on the running app: measure per-edge lane coordinates in the DOM and confirm
   distinct lanes; screenshot for the record.

---

## A — Model editor

### A1. Storage: files behind a dev API

- Models are files: `apps/eer/models/<slug>.json`, in the same raw JSON schema `loadModel`
  validates. Git-trackable. The current bundled `src/model/eer-model.json` is copied to
  `models/items-platform.json` as the seed; the bundled copy remains the no-API fallback.
- The "API server" is a **Vite dev-middleware plugin** (`apps/eer/vite-plugins/models-api.ts`,
  wired in `vite.config.ts`) — same process as `pnpm dev`, no extra server:

| Route | Effect |
|---|---|
| `GET /api/models` | `[{ id, title }]` — id is the filename slug |
| `GET /api/models/:id` | raw model JSON |
| `POST /api/models` | create; slug generated from title; 409 on collision |
| `PUT /api/models/:id` | save; atomic write (tmp file + rename) |
| `DELETE /api/models/:id` | delete file |

- Slugs are `[a-z0-9-]+` only (sanitized on create, rejected on lookup) — no path traversal.
- Requests validate the body with `loadModel` before writing; errors return 422 with the messages.
- **Dev-only:** the built/deployed viewer has no API; the UI hides editing when
  `GET /api/models` fails, degrading to today's read-only viewer.

### A2. Raw schema addition: persisted layout

Optional `x`/`y` on each raw entity, and an optional `bounds` (`x/y/w/h`) on each raw group.
`loadModel` reads them when present; `packLayout` fills only what is missing. Saving a model
serializes current positions, so hand-arranged layouts survive reload. Old files without
positions keep working (full auto-layout).

Also an optional top-level `colors: Record<string, string>` — the colour-override map (zone /
subgroup / entity id → hex) that today lives only in UI state. `LOAD` seeds `ui.colors` from it;
save serializes `ui.colors` back. The modal colour fields and the existing overview colour form
edit the same map, so colours finally survive reload too.

### A3. Editing state: immutable Model edits

- One new reducer action — `{ type: 'APPLY_MODEL_EDIT', edit: ModelEdit }` — where `ModelEdit` is:
  `{ kind: 'upsertGroup' | 'deleteGroup' | 'upsertEntity' | 'deleteEntity' | 'setMeta', ... }`.
- A pure engine module `engine/model/apply-model-edit/` (one function per folder + tests)
  produces the next `Model`: recomputes `entityById`, group bounds, measurements for touched
  entities, and **derives relationships from FK fields** (below). Untouched positions are
  preserved — editing never re-layouts the diagram. A new table spawns inside its group's box.
- **Connections are derived, not edited:** field with `role: 'fk'` + `ref` ⇒ relationship
  (kind `fk`); clearing role/ref removes it. Explicit `relationships` in loaded files are still
  honored; editor-made changes regenerate the FK-derived subset only. Deleting a table clears FK
  refs that point at it — the confirm dialog lists exactly which fields will be cleared.
- `ui.dirty` flags unsaved changes (set by `APPLY_MODEL_EDIT` and `SET_POSITIONS`/`RESIZE_GROUP`,
  cleared by load/save). Serialization is a pure `engine/model/serialize-model/` module with a
  roundtrip test: `loadModel(serializeModel(m))` ≡ `m`.

### A4. UI

- **TopBar additions:** model dropdown (from `GET /api/models`; switching loads — warns when
  dirty), **New model** button, **＋ Add** button (chooser: group / subgroup / table), **Save**
  button with dirty indicator. A new model is seeded with one zone and one starter table
  (`loadModel` requires non-empty groups and entities; seeding keeps validation strict).
- **Modals** (one shared `components/modal/` primitive over the canvas; Esc/backdrop closes,
  buttons confirm):
  - *Model:* title, description; danger zone: delete model (confirm).
  - *Group:* name, kind (zone / subgroup of a chosen zone), colour; delete blocked while it
    contains tables (message says which).
  - *Table:* name, group picker, colour override, description, and a **field grid** — per row:
    name · type · role (– / PK / FK) · ref table + ref field (enabled when FK) · note · ↑↓ ·
    remove; plus add-field. Danger zone: delete table (lists the FK refs that will be cleared).
- **Entry points:** detail panel keeps its read view and gains an **Edit** button per selection
  (entity/group) opening the matching modal. The colour form stays as-is on the overview.

### A5. Testing

- Engine: `apply-model-edit` per edit-kind; FK→relationship derivation; `serialize-model`
  roundtrip; positions honored by `loadModel`/`packLayout`.
- API plugin: handler-level tests (create/save/delete happy paths, slug rejection, 422 on
  invalid body) with a temp dir.
- UI: testing-library tests for the modals (field-grid edits dispatch the right `ModelEdit`;
  delete confirms list cleared refs) and the TopBar model dropdown (loads on select).
- End-to-end: live check against `pnpm dev` — create model, add zone + 2 tables, FK-link them,
  save, reload, confirm layout + data survived.

### Out of scope (deliberate)

- Editing edge *kinds* (fk vs many-to-many) — derived edges are always `fk`; explicit
  relationship lists in hand-written files remain read-only.
- Auth, multi-user, or API availability in the built container.
- Undo/redo (dirty-flag + reload-from-file is the escape hatch).

---

## Types

Raw model file (extended):

```ts
interface RawModel {
  meta?: { title?: string; description?: string };
  view?: { routing?: 'curved' | 'avoid' | 'ortho' };
  colors?: Record<string, string>;                                          // NEW: colour overrides
  kinds?: { id: string; label: string; style?: 'solid' | 'dashed' }[];
  groups: { id: string; label: string; order?: number; parent?: string | null;
            bounds?: { x: number; y: number; w: number; h: number } }[];   // bounds: NEW
  entities: { id: string; label?: string; group: string; description?: string;
              x?: number; y?: number;                                      // NEW
              fields: { name: string; type?: string; role?: 'pk' | 'fk' | null;
                        ref?: string | null; refField?: string | null;
                        title?: string | null; description?: string | null }[] }[];
  relationships?: { id?: string; source: string; sourceField: string; target: string;
                    targetField: string; kind?: string | null; label?: string | null;
                    cardinality?: '1-1' | '1-n' | 'n-1' | 'n-m' }[];
}
```

Editor edit union:

```ts
type ModelEdit =
  | { kind: 'setMeta'; title: string; description: string }
  | { kind: 'upsertGroup'; group: { id: string; label: string; parent: string | null } }
  | { kind: 'deleteGroup'; id: string }
  | { kind: 'upsertEntity'; entity: { id: string; label: string; group: string;
      description: string | null; fields: RawField[] } }   // RawField = raw entity field above
  | { kind: 'deleteEntity'; id: string };
```

API surface: see the route table in A1 (JSON in/out; errors as `{ error: string }` with 4xx).
