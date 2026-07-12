# EER viewer: React migration of the imperative engine

**Date:** 2026-07-12 · **App:** `apps/eer` · **Branch:** `redesign`

## Goal

Delete the imperative `EerDiagram` class and every DOM-building/DOM-mutating function
in `src/engine`. React renders the diagram scene declaratively (components, hooks, one
provider); `src/engine` keeps only pure calculation functions. Behavior and visuals
stay identical — same DOM shape, same class names, same `app.css`.

**Locked approach (user-approved):** pure React state — context provider + reducer,
no new dependencies, no imperative ref fast-path, no external store.

## Non-goals

- No visual or behavioral changes. Drag, pan, zoom-to-cursor, group move/resize,
  focus/dim, field highlight, search, routing modes, self-checks — all identical.
- No restyling of scene DOM to Tailwind; scene keeps `app.css` classes and CSS vars.
- No fixing of the two documented quirks (`visibleBounds` direct-group filtering,
  index-based zone sync) unless they fall out naturally — the zone-sync quirk *does*
  die with `relayout`, since React keys zone boxes by group id.

## Architecture

```
<DiagramProvider>                    state: model · view · ui, plus derived routes
  <TopBar/>                          reads context (engine prop removed)
  <Viewport>                         hooks: usePanZoom, useGestures, ref for fit
    <World>                          style transform from view slice
      <ZoneBoxes/> → <ZoneBox/>      one .zone per group bound, keyed by id
      <EdgesSvg/>  → <Edge/>         one .edge <g> per relationship
      <EntityCards/> → <EntityCard/> .card + field rows + port spans
    </World>
    <ErrorBanner/> <ChecksOverlay/>
  </Viewport>
  <DetailPanel/>                     reads context (engine prop removed)
</DiagramProvider>
```

### DOM parity (hard requirement)

Scene components emit exactly the DOM `build-scene.ts` builds today: `.world`,
`.layer.groups`, `.zone`/`.zone-sub` + `.zone-label`, `.edges` SVG, `.edge` `<g>`
containing `.edge-hit`/`.edge-casing`/`.edge-path`(+`.dashed`)/`.edge-head`, `.card`
with `.card-hd`/`.card-title`/`.card-body`, `.field` rows with `.badge`/`.fname`/
`.ftype` and `.port.left`/`.port.right`, all `data-entity`/`data-field`/`data-side`/
`data-group`/`data-parent`/`data-rel`/`data-kind`/`data-index` attributes, and the
`--entity-c`/`--group-c`/`--edge-c` CSS custom properties. State classes keep their
names: `dim`, `focus`, `selected`, `hot`, `active`, `on`, `hidden`, `edge-top`.
`app.css` is not edited. This keeps visuals pixel-identical and `runChecks` valid.

## State

One `DiagramProvider` owning a single `useReducer`. The provider exposes **slice
contexts** (model, view, ui, routes, dispatch) so memoized scene components only
re-render when their slice changes.

- **model** (`Model`) — entities (including `x/y/_w/_h`), groups, relationships,
  kinds, `_groupBounds`, `_content`. Updated **immutably with structural sharing**:
  `MOVE_ENTITY` produces a new model whose entities array replaces only the moved
  entity object; untouched entities keep identity, so `memo(EntityCard)` skips them.
- **view** — `{ zoom, panX, panY, routing }`.
- **ui** — `{ selection, focus, hidden: {groups, kinds}, colors, fieldHighlight,
  gesture }`. `gesture` is `'idle' | 'dragging'`; while `'dragging'` edges use the
  fast path (per-edge `simpleOrtho`) exactly like today's `fast=true`, and the full
  `computeRoutes` runs once on mouseup.
- **routes** (derived, not reducer state) — `useMemo(() => computeRoutes(model),
  [model, view.routing, ui.gesture])` in the provider, yielding a
  `Map<relId, Route>`. `Edge` reads its path from it; `EntityCard` derives which
  ports get `.on` from route endpoints (this replaces `mark-connected-ports`).

Reducer actions (names indicative): `LOAD`, `MOVE_ENTITY`, `MOVE_GROUP`,
`RESIZE_GROUP`, `REARRANGE`,
`SET_VIEW` (pan/zoom/fit — fit math runs in `useFit`, which needs viewport size),
`SET_ROUTING`, `SET_COLORS`, `TOGGLE_GROUP`, `TOGGLE_KIND`,
`SELECT_ENTITY`, `SELECT_GROUP`, `ISOLATE_EDGE`, `ISOLATE_EDGE_SILENT`,
`FOCUS_FROM_SEARCH`, `HIGHLIGHT_FIELD`, `CLEAR_FIELD_HIGHLIGHT`, `CLEAR_SELECTION`,
`SET_GESTURE`. Group move/resize clamping (child containment, parent confinement,
min 140×80, `IN_PAD`/`IN_LABEL` insets) moves into pure helpers the reducer calls.

This also removes today's duplicated state: `EerViewer` currently mirrors routing/
hidden/colors/selection next to the engine's copies. After the migration there is
one owner (the reducer); `TopBar`, `SearchBox`, and `DetailPanel` drop their
`engine` prop and call context actions.

## Hooks

| Hook | Replaces | Behavior |
|---|---|---|
| `usePanZoom(viewportRef)` | `wireGlobal` wheel + pan branches | Wheel zoom-to-cursor (clamp 0.15–3), middle-button pan, empty-space left-drag pan; dispatches `SET_VIEW` |
| `useGestures(viewportRef)` | `wireGlobal` mousedown/move/up | One mousedown dispatcher: card→entity drag, zone edge→resize (with hover resize cursor), zone body→group drag, empty→idle/pan; click-vs-drag via 3px threshold; Escape clears selection |
| `useModelLoader()` | `EerViewer` effect + `EerDiagram.load` | Fetch `?model=` or default JSON, `loadModel` diagnostics, dispatch `LOAD`; `fonts.ready` re-pack + refit; double-rAF initial fit |
| `useFocusInfo()` | `focus/*` classList halves | Memoizes related-entity/edge sets from `ui.focus` via pure selectors; returns per-id `dim/focus/selected/active` answers |
| `useFit(viewportRef)` | `fit`/`centerOn` | Reads `clientWidth/Height`, calls pure `fitView`, dispatches `SET_VIEW` |

Hover state that today is direct `classList` (`hot` on edges and field rows) becomes
local component state (`onMouseEnter`/`Leave` on `Edge` / `FieldRow`) — no reflow,
no coordinate changes, matching the "class toggles only" rule.

## Engine after the split

**Stays, unchanged:** `model/` (types, load-model, infer-cardinality), `geometry/`
(all), `groups/` (all), `layout/visible-bounds`, `routing/` (all except
`compute-routes`' signature), `render/` color helpers → move to `engine/colors/`
(`entity-color`, `edge-color`, `group-color`), `css-esc`, `end-kinds`.

**Stays, re-shaped** (the only intentional engine signature changes):
- `layout/pack-layout` — pure: returns a new packed `Model` instead of mutating.
- `routing/compute-routes` — pure: returns `Map<string, Route>` instead of writing
  `rel._route` / `rel._srcSlot` / `rel._tgtSlot` onto relationships; those three
  underscore fields leave the `Relationship` type (routes live only in the derived
  provider memo).
- `layout/fit-view` (new) — pure extraction of `fit()`/`centerOn()` math:
  `(bounds, viewportSize, opts) => { zoom, panX, panY }`.
- `focus/*` → pure selectors: `relatedToEntity(model, id)`, `relatedToGroup(model,
  id)`, `isolatedEdge(model, relId)`, `visibleIds(model, hidden)` return id-sets;
  the classList application halves are deleted.
- `checks/run-checks` — same four checks, new signature `runChecks({ model, root })`
  querying the DOM under `root` instead of `EngineState.els` maps.
- `search/search-model` (new) — pure extraction of `EerDiagram.search` (index build,
  filter, `.slice(0, 20)` cap).

**Deleted:** `diagram/eer-diagram`, `render/build-scene`, `render/position-entity`,
`render/apply-transform`, `render/draw-edge`, `render/draw-all-edges`,
`render/draw-edges-for-entity`, `render/set-colors`, `render/set-routing`,
`render/relayout`, `render/mark-connected-ports`, and the `EngineState`/`EdgeEls`
element-map types they shared (`Model`, `Selection`, `CheckResult`, etc. remain).

## Error handling

Unchanged: `useModelLoader` surfaces `loadModel` errors/warnings through the existing
`ErrorBanner`; a failed `?model=` fetch shows the same "Could not load …" error. A
model with errors never reaches the reducer.

## Testing

- Pure engine util tests: unchanged, except `pack-layout` tests adapt to the pure
  return and new `fit-view` / `search-model` / selector tests are added.
- DOM-flavored engine tests (`build-scene`, `focus/*` application, `position-entity`,
  `apply-transform`, `draw-*`, `eer-diagram`) are **replaced** by React Testing
  Library tests on the new components/hooks, reusing `test/models.ts` fixtures.
  `test/scene.ts` becomes an RTL helper that renders `<DiagramProvider>` + scene
  with a fixture model and returns query utilities.
- Component tests assert observable behavior (classes on the rendered DOM, path
  `d` presence, port `.on` marking, selection callbacks), same standard as the
  existing suite; jsdom caveats carry over (no canvas text metrics, zero rects).
- Dev handle: `window.__eer` becomes `{ getState, dispatch }` (DEV only) so browser
  verification and self-checks remain scriptable.

**Done means:** `pnpm typecheck` clean · full `@tickets/eer` suite green ·
`pnpm build` clean · live on :4630 the fixture model renders 22 cards / 37 edges,
4/4 self-checks pass, and drag / pan / wheel-zoom / group move+resize / focus /
search / routing cycle / colors behave identically to `HEAD`.

## Types

Named types used above, as they exist today in `engine/model/types` (abridged to the
fields this spec relies on):

```ts
type RoutingMode = 'curved' | 'avoid' | 'ortho';

interface Model {
  meta: { title?: string; description?: string };
  view: { zoom: number; routing: RoutingMode };
  kinds: { id: string; label: string; style?: string }[];
  kindStyle: Map<string, string>;
  groups: { id: string; label: string; parent?: string; order?: number }[];
  entities: Entity[];
  entityById: Map<string, Entity>;
  relationships: Relationship[];
  relById: Map<string, Relationship>;
  _groupBounds: GroupBounds[];   // packed zone/subgroup boxes
  _content: { w: number; h: number };
}

interface Entity {
  id: string; label: string; group: string; description: string | null;
  fields: { name: string; type: string; role: 'pk' | 'fk' | null; ref?: string; refField?: string }[];
  x: number; y: number; _w: number; _h: number;   // layout-filled
}

interface Relationship {
  id: string; source: string; sourceField: string;
  target: string; targetField: string;
  cardinality: '1-1' | '1-n' | 'n-1' | 'n-m'; cardinalityInferred: boolean;
  kind: string | null; label: string | null;
  // today also carries routing-filled _route/_srcSlot/_tgtSlot — removed by this
  // design (see compute-routes re-shape)
}

interface GroupBounds {
  id: string; label: string; parent: string | null; level: number; // 0 zone, 1 subgroup
  x: number; y: number; w: number; h: number;
}

type Selection =
  | { type: 'none' } | { type: 'entity'; id: string }
  | { type: 'group'; id: string } | { type: 'edge'; id: string };

interface CheckResult { name: string; pass: boolean; scope: string; problems: string[] }

// New with this design:
interface Route {
  points: Point[] | null;        // null → curved/self-loop path computed per-edge
  srcSlot: number; tgtSlot: number; // pin-fan y-offsets at shared ports
}
interface Point { x: number; y: number }

interface DiagramState {
  model: Model | null;
  view: { zoom: number; panX: number; panY: number; routing: RoutingMode };
  ui: {
    selection: string | null;                       // selected entity id
    focus: { type: 'entity' | 'group' | 'edge'; id: string } | null;
    hidden: { groups: Set<string>; kinds: Set<string> };
    colors: ReadonlyMap<string, string>;
    fieldHighlight: { entityId: string; field: string } | null;
    gesture: 'idle' | 'dragging';
  };
}
```
