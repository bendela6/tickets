# EER React Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete the imperative `EerDiagram` class; React components/hooks/one provider render the diagram scene from reducer state; `src/engine` keeps only pure calculation functions.

**Architecture:** A `DiagramProvider` (useReducer, slice contexts) owns model/view/ui state; scene components (`ZoneBoxes`, `EdgesSvg`, `EntityCards`) render the exact DOM `build-scene.ts` builds today; gestures are hooks that dispatch actions; edge routes/pin-fans are a derived memo. Engine mutation points (`packLayout`, `computePinSlots`, `computeRoutes`) become pure first, then the React scene is built alongside the legacy engine, then the legacy render/focus/diagram code is deleted.

**Tech Stack:** React 19, TypeScript strict, Vitest + @testing-library/react (jsdom), Tailwind v4 for chrome components only — the scene keeps `app.css` classes.

**Spec:** `docs/superpowers/specs/2026-07-12-eer-react-migration-design.md`

## Global Constraints

- **No new dependencies.** Everything is built with react, react-dom, and the existing test stack.
- **DOM/CSS parity:** scene markup must emit exactly today's classes/attributes: `.world`, `.layer.groups`, `.zone`/`.zone-sub`, `.zone-label`, `.edges` svg, `.edge` `<g>` > `.edge-hit`/`.edge-casing`/`.edge-path`(+`.dashed`)/`.edge-head`, `.card` > `.card-hd`>`.card-title`, `.card-body` > `.field` (+`role-pk`/`role-fk`) > `.badge`/`.fname`/`.ftype`/`.port.left`/`.port.right`; data attrs `data-entity/-field/-side/-index/-group/-parent/-rel/-kind`; CSS vars `--entity-c/--group-c/--edge-c`; state classes `dim focus selected hot active hidden connected zone-selected zone-dim edge-top`. `app.css` is never edited.
- **File convention:** every exported function/component gets `{name}/{name}.ts(x)` + `{name}.test.ts(x)` + `index.ts` (re-export public only). Private helpers colocate in the public unit's file or sibling files not exported from `index.ts`.
- **Commands** (run from `apps/eer`): tests `pnpm exec vitest run [path]`; whole-repo typecheck from repo root `pnpm typecheck`; build from repo root `pnpm build`.
- **Commits:** conventional, scope `(eer)`, one commit per task, **no Co-Authored-By lines**.
- **jsdom caveats:** no canvas (`measureText` falls back to 7px/char — never assert exact widths); `getBoundingClientRect` returns zeros; polyfill `requestAnimationFrame` where needed; css `?raw` imports resolve to empty strings.
- Until Task 15 flips `EerViewer`, the legacy engine keeps running the app — every task must leave the full suite green (`pnpm exec vitest run`) and typecheck clean.

## File Map (end state)

```
src/engine/                      pure calculation only
  colors/{entity-color,edge-color,group-color}/     (T1, from render/)
  dom/css-esc/                                      (T1, from render/)
  model/{types,load-model,infer-cardinality,end-kinds}/   (end-kinds T1, from render/)
  geometry/  (unchanged + compute-pin-slots pure T2, edge-endpoints slot param T3)
  groups/    (unchanged)
  layout/{pack-layout (pure T6), visible-bounds, fit-view (new T8)}/
  routing/   (+ edge-geometry T5, edge-path T5; compute-routes pure core T4)
  focus/{related-to-entity,related-to-group,isolated-edge,field-edges,hidden-ids,connected-ports}/  (T7)
  search/search-model/                               (T8)
  checks/run-checks/                                 (re-signatured T14)
src/state/
  diagram-reducer/               (T9)  pure reducer + state/action types
  diagram-context.ts             (T10) contexts + useDiagram* hooks
  diagram-provider/              (T10) provider, derived geometry, actions, dev handle
src/hooks/
  use-diagram-gestures/          (T13)
  use-model-loader/              (T15)
src/components/diagram/
  diagram/                       (T15) .viewport div + World + overlay children
  world/                         (T11) .world transform wrapper
  zone-boxes/                    (T11)
  entity-cards/                  (T11) EntityCards + entity-card.tsx + field-row.tsx
  edges-svg/                     (T12) EdgesSvg + edge.tsx
src/test/render.tsx              (T10) RTL helper replacing test/scene.ts
DELETED in T16: engine/diagram/, engine/render/{build-scene,position-entity,apply-transform,
  draw-edge,draw-all-edges,draw-edges-for-entity,set-colors,set-routing,relayout,
  mark-connected-ports}, engine/focus (legacy 9), legacy wrappers, test/scene.ts,
  Relationship._route/_srcSlot/_tgtSlot, Model._pinSpan, EngineEls/EngineState/EdgeEls
```

## Task Index

1. Relocate pure leaf utils (colors, css-esc, end-kinds) + `edgeColor` re-signature
2. `compute-pin-slots`: pure core + legacy wrapper
3. `edge-endpoints`: optional slot parameter
4. `compute-routes`: pure core `routeEdges` + legacy wrapper
5. `computeEdgeGeometry` orchestrator + pure `edgePath` builder
6. `pack-layout`: pure (returns new model)
7. Focus/visibility pure selectors
8. `fit-view` + `search-model`
9. Diagram reducer (pure)
10. DiagramProvider, contexts, actions, derived geometry, test render helper
11. Scene components: World, ZoneBoxes, EntityCards
12. Scene components: EdgesSvg + Edge
13. `use-diagram-gestures` (pan/zoom/drag/resize/keyboard)
14. `run-checks` re-signature (React-scene compatible)
15. The switch: `use-model-loader`, Diagram composition, EerViewer/TopBar/SearchBox/DetailPanel rewire
16. Delete legacy engine UI code + type cleanup
17. Live verification on :4630

---

### Task 1: Relocate pure leaf utils

**Files:**
- Create: `src/engine/colors/entity-color/` `src/engine/colors/edge-color/` `src/engine/colors/group-color/` `src/engine/dom/css-esc/` `src/engine/model/end-kinds/` (each `{name}.ts` + `{name}.test.ts` + `index.ts`, moved from `src/engine/render/...`)
- Delete: `src/engine/render/{entity-color,edge-color,group-color,css-esc,end-kinds}/`
- Modify: every importer (find with grep, step 2)

**Interfaces:**
- Consumes: existing implementations (move verbatim except edge-color).
- Produces: `entityColor(model, entityId, overrides?): string` · `groupColor(model, groupId, overrides?): string` + `GROUP_PALETTE` · `cssEsc(s: string): string` · `endKinds(c: Cardinality): [EndKind, EndKind]` + `type EndKind` · **re-signatured** `edgeColor(model: Model, entityId: string, overrides?: ReadonlyMap<string, string>): string` (was `(state: EngineState, entityId)` — it only read `state.model`/`state.colors`).

- [ ] **Step 1: Move folders with git mv** (preserves history; tests move along):

```bash
cd apps/eer/src/engine
mkdir -p colors dom
git mv render/entity-color colors/entity-color
git mv render/edge-color colors/edge-color
git mv render/group-color colors/group-color
git mv render/css-esc dom/css-esc
git mv render/end-kinds model/end-kinds
```

- [ ] **Step 2: Re-signature edge-color.** New `colors/edge-color/edge-color.ts`:

```ts
// Edge colour = an entity's colour. Edges are coloured by their FK-side (target)
// entity — the table that holds the key.

import { entityColor } from '../entity-color';
import type { Model } from '../../model/types';

export function edgeColor(model: Model, entityId: string, overrides?: ReadonlyMap<string, string>): string {
  return entityColor(model, entityId, overrides);
}
```

Update its test to call `edgeColor(model, id, overrides)` (assert same result as `entityColor` for an override + a palette fallback case).

- [ ] **Step 3: Rewire all importers.** `grep -rn "render/entity-color\|render/edge-color\|render/group-color\|render/css-esc\|render/end-kinds" src` and fix each path (`../colors/...`, `../dom/css-esc`, `../model/end-kinds`; adjust `../`/`../../` depth per file). Call sites of `edgeColor(state, x)` become `edgeColor(state.model, x, state.colors)` — they are `render/build-scene/build-scene.ts:52` and `render/set-colors/set-colors.ts:18`. Also fix the moved files' own relative imports (e.g. `entity-color` imports `../group-color`; `group-color` imports `../../groups/zone-id-of`).

- [ ] **Step 4: Verify** — from `apps/eer`: `pnpm exec vitest run` → all pass; from repo root: `pnpm typecheck` → clean.

- [ ] **Step 5: Commit**

```bash
git add -A apps/eer
git commit -m "refactor(eer): move colour/css-esc/end-kinds utils out of render

Pure helpers relocate to engine/colors, engine/dom, engine/model; edgeColor
takes (model, id, overrides) instead of EngineState ahead of the React scene."
```

---

### Task 2: compute-pin-slots — pure core + legacy wrapper

**Files:**
- Modify: `src/engine/geometry/compute-pin-slots/compute-pin-slots.ts`, its test, `index.ts`

**Interfaces:**
- Consumes: `edgeSides`, `fieldIndex`, `portKey`, `portWorldPos` (unchanged).
- Produces:

```ts
export interface EdgeSlots { src: number; tgt: number }
export interface PinSlotResult {
  slots: Map<string, EdgeSlots>;   // relId → pin-fan y-offsets
  pinSpan: Map<string, number>;    // portKey(entity,field,side) → half-span (0 = single line)
}
export function pinSlots(model: Model): PinSlotResult;          // PURE — never touches model
export function computePinSlots(model: Model): void;            // legacy wrapper, deleted in T16
```

- [ ] **Step 1: Write the failing test** (add to existing `compute-pin-slots.test.ts`):

```ts
import { pinSlots } from './compute-pin-slots';

it('pinSlots returns fan offsets without mutating the model', () => {
  const model = buildModel(); // twoZoneRaw: users.id feeds u-o and self → shared port fans
  const before = JSON.stringify(model.relationships.map((r) => [r._srcSlot, r._tgtSlot]));
  const { slots, pinSpan } = pinSlots(model);
  expect(JSON.stringify(model.relationships.map((r) => [r._srcSlot, r._tgtSlot]))).toBe(before);
  expect(model._pinSpan).toBeUndefined();
  expect(slots.size).toBe(model.relationships.length);
  // legacy wrapper writes the same numbers onto the model:
  computePinSlots(model);
  for (const rel of model.relationships) {
    expect(rel._srcSlot).toBe(slots.get(rel.id)!.src);
    expect(rel._tgtSlot).toBe(slots.get(rel.id)!.tgt);
  }
  expect([...(model._pinSpan ?? new Map())]).toEqual([...pinSpan]);
});
```

- [ ] **Step 2: Run** `pnpm exec vitest run src/engine/geometry/compute-pin-slots` → FAIL (`pinSlots` not exported).

- [ ] **Step 3: Implement.** Refactor the existing body: build the same `ports` map, but write offsets into a local `slots` map (initialize every relId to `{src: 0, tgt: 0}` where the old code set `rel._srcSlot = 0`), and return `{ slots, pinSpan: span }`. Then:

```ts
export function computePinSlots(model: Model): void {
  const { slots, pinSpan } = pinSlots(model);
  for (const rel of model.relationships) {
    const s = slots.get(rel.id);
    rel._srcSlot = s?.src ?? 0;
    rel._tgtSlot = s?.tgt ?? 0;
  }
  model._pinSpan = pinSpan;
}
```

Keep `SLOT_GAP`/`MAX_FAN` and the sort-by-otherY logic identical. Export `pinSlots`, `EdgeSlots`, `PinSlotResult` from `index.ts` too.

- [ ] **Step 4: Run** the folder's tests + full suite → PASS.

- [ ] **Step 5: Commit** — `refactor(eer): pure pinSlots core behind computePinSlots wrapper`

---

### Task 3: edge-endpoints — optional slot parameter

**Files:**
- Modify: `src/engine/geometry/edge-endpoints/edge-endpoints.ts`, its test

**Interfaces:**
- Consumes: `EdgeSlots` from `../compute-pin-slots`.
- Produces: `edgeEndpoints(model: Model, rel: Relationship, slot?: EdgeSlots): EdgeEndpoints` — when `slot` is given, use it; otherwise fall back to `rel._srcSlot ?? 0` / `rel._tgtSlot ?? 0` (legacy path, removed in T16).

- [ ] **Step 1: Write the failing test:**

```ts
it('applies explicit slot offsets over the rel fields', () => {
  const model = buildModel();
  const rel = model.relById.get('u-o')!;
  const base = edgeEndpoints(model, rel, { src: 0, tgt: 0 });
  const fanned = edgeEndpoints(model, rel, { src: 4, tgt: -4 });
  expect(fanned.p1.y).toBe(base.p1.y + 4);
  expect(fanned.p2.y).toBe(base.p2.y - 4);
});
```

- [ ] **Step 2: Run** → FAIL (extra arg ignored / y unchanged).

- [ ] **Step 3: Implement** — replace the two slot lines:

```ts
p1.y += slot ? slot.src : (rel._srcSlot ?? 0);
p2.y += slot ? slot.tgt : (rel._tgtSlot ?? 0);
```

- [ ] **Step 4: Run** folder + full suite → PASS.
- [ ] **Step 5: Commit** — `refactor(eer): edgeEndpoints accepts explicit pin-slot offsets`

---

### Task 4: compute-routes — pure core `routeEdges` + legacy wrapper

**Files:**
- Modify: `src/engine/routing/compute-routes/compute-routes.ts`, its test, `index.ts`

**Interfaces:**
- Consumes: `EdgeSlots` (T2), `edgeEndpoints(model, rel, slot)` (T3).
- Produces:

```ts
export interface RouteResult {
  routes: Map<string, Point[] | null>;  // relId → routed polyline (null = self-loop)
  slots: Map<string, EdgeSlots>;        // input slots, possibly adjusted by port-slot reordering
}
export function routeEdges(model: Model, slots: ReadonlyMap<string, EdgeSlots>): RouteResult; // PURE
export function computeRoutes(model: Model): void;  // legacy wrapper, deleted in T16
```

- [ ] **Step 1: Write the failing test** (add to `compute-routes.test.ts`):

```ts
import { pinSlots } from '../../geometry/compute-pin-slots';
import { routeEdges } from './compute-routes';

it('routeEdges is pure and matches the legacy wrapper output', () => {
  const model = buildModel();
  const { slots } = pinSlots(model);
  const snap = JSON.stringify(model.relationships.map((r) => [r._srcSlot, r._tgtSlot, r._route ?? 'unset']));
  const res = routeEdges(model, slots);
  expect(JSON.stringify(model.relationships.map((r) => [r._srcSlot, r._tgtSlot, r._route ?? 'unset']))).toBe(snap);
  expect(res.slots).not.toBe(slots); // adjusted copy, never the caller's map
  // wrapper writes the same routes onto the rels:
  computePinSlots(model);
  computeRoutes(model);
  for (const rel of model.relationships) {
    expect(rel._route ?? null).toEqual(res.routes.get(rel.id) ?? null);
  }
});
```

- [ ] **Step 2: Run** `pnpm exec vitest run src/engine/routing/compute-routes` → FAIL (`routeEdges` not exported).

- [ ] **Step 3: Implement.** Inside `compute-routes.ts` (all machinery is already private to this file):
  1. Add `routeEdges(model, slots)`: first lines make a working copy `const slotsW = new Map([...slots].map(([k, v]) => [k, { ...v }]))` and `const routes = new Map<string, Point[] | null>()`.
  2. Thread `slotsW`/`routes` through the private passes instead of the `rel._*` fields:
     - the top loop `rel._route = ... routePolyline(...)` → `routes.set(rel.id, ...)`;
     - every `rel._route` read (channel-ordering pass ~line 67, port-slot pass ~line 278) → `routes.get(rel.id)`;
     - `rel._srcSlot ?? 0` / `rel._tgtSlot ?? 0` reads (~line 286) → `slotsW.get(rel.id)?.src ?? 0` / `.tgt ?? 0`;
     - the port-slot reorder writes (~lines 355-359, `x.e.rel._srcSlot = slot`) → mutate `slotsW.get(x.e.rel.id)!.src` / `.tgt`;
     - `edgeEndpoints(model, rel)` calls inside this file → `edgeEndpoints(model, rel, slotsW.get(rel.id))`.
  3. Return `{ routes, slots: slotsW }`.
  4. Legacy wrapper reads current rel fields and writes results back:

```ts
export function computeRoutes(model: Model): void {
  const slots = new Map(model.relationships.map((r) => [r.id, { src: r._srcSlot ?? 0, tgt: r._tgtSlot ?? 0 }]));
  const { routes, slots: adjusted } = routeEdges(model, slots);
  for (const rel of model.relationships) {
    rel._route = routes.get(rel.id) ?? null;
    const s = adjusted.get(rel.id);
    rel._srcSlot = s?.src ?? 0;
    rel._tgtSlot = s?.tgt ?? 0;
  }
}
```

- [ ] **Step 4: Run** folder + full suite → PASS (the existing route-quality tests now exercise the pure core through the wrapper).
- [ ] **Step 5: Commit** — `refactor(eer): pure routeEdges core behind computeRoutes wrapper`

---

### Task 5: computeEdgeGeometry orchestrator + pure edgePath builder

**Files:**
- Create: `src/engine/routing/edge-geometry/{edge-geometry.ts,edge-geometry.test.ts,index.ts}`
- Create: `src/engine/routing/edge-path/{edge-path.ts,edge-path.test.ts,index.ts}`

**Interfaces:**
- Consumes: `pinSlots` (T2), `routeEdges` (T4), `edgeEndpoints(model, rel, slot)` (T3), `simpleOrtho`, `smoothPath`, `orthoPolyPath`, `endKinds` (from `engine/model/end-kinds` after T1), `PORT_GAP` from `engine/geometry/metrics`.
- Produces:

```ts
// edge-geometry
export interface EdgeGeometry {
  slots: Map<string, EdgeSlots>;
  pinSpan: Map<string, number>;
  routes: Map<string, Point[] | null>;  // empty Map in curved mode
}
export function computeEdgeGeometry(model: Model, routing: RoutingMode): EdgeGeometry;

// edge-path
export interface EdgePathD { d: string; head: string }
export function edgePath(model: Model, rel: Relationship, routing: RoutingMode, geometry: EdgeGeometry, live: boolean): EdgePathD;
```

- [ ] **Step 1: Write failing tests:**

`edge-geometry.test.ts`:

```ts
it('curved mode: slots + spans, no routes', () => {
  const g = computeEdgeGeometry(buildModel(), 'curved');
  expect(g.routes.size).toBe(0);
  expect(g.slots.size).toBe(3);
});
it('avoid mode: a route per non-self relationship, self is null', () => {
  const model = buildModel();
  const g = computeEdgeGeometry(model, 'avoid');
  expect(g.routes.get('u-o')).toBeTruthy();
  expect(g.routes.get('self')).toBeNull();
  expect(model._pinSpan).toBeUndefined(); // pure: model untouched
});
```

`edge-path.test.ts` (mirrors the current draw-edge tests):

```ts
function endpointsOf(d: string) {
  const n = (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  return { start: { x: n[0]!, y: n[1]! }, end: { x: n[n.length - 2]!, y: n[n.length - 1]! } };
}
it('path starts and ends on the fanned ports in every mode', () => {
  const model = buildModel();
  for (const mode of ['curved', 'avoid', 'ortho'] as const) {
    const g = computeEdgeGeometry(model, mode);
    const rel = model.relById.get('u-o')!;
    const { p1, p2 } = edgeEndpoints(model, rel, g.slots.get(rel.id));
    const { start, end } = endpointsOf(edgePath(model, rel, mode, g, false).d);
    expect(Math.hypot(start.x - p1.x, start.y - p1.y)).toBeLessThan(0.5);
    expect(Math.hypot(end.x - p2.x, end.y - p2.y)).toBeLessThan(0.5);
  }
});
it('self-loop bulges right of the card and has no head', () => {
  const model = buildModel();
  const g = computeEdgeGeometry(model, 'curved');
  const out = edgePath(model, model.relById.get('self')!, 'curved', g, false);
  expect(out.head).toBe('');
  expect(out.d.startsWith('M ')).toBe(true);
});
it('live=true falls back to the cheap direct shape (never throws without routes)', () => {
  const model = buildModel();
  const g = computeEdgeGeometry(model, 'avoid');
  const rel = model.relById.get('u-o')!;
  expect(edgePath(model, rel, 'avoid', g, true).d.length).toBeGreaterThan(0);
  expect(edgePath(model, rel, 'avoid', { ...g, routes: new Map() }, false).d.length).toBeGreaterThan(0);
});
it('many end gets a crow-foot head', () => {
  const model = buildModel(); // u-o is 1-n → target end is the many side
  const g = computeEdgeGeometry(model, 'curved');
  expect(edgePath(model, model.relById.get('u-o')!, 'curved', g, false).head).toContain('M');
});
```

- [ ] **Step 2: Run** → FAIL (modules don't exist).

- [ ] **Step 3: Implement.**

`edge-geometry.ts`:

```ts
// One pure pass per scene change: pin fans first (endpoints depend on them),
// then routed polylines for the modes that use them.

import { pinSlots, type EdgeSlots } from '../../geometry/compute-pin-slots';
import { routeEdges } from '../compute-routes';
import type { Model, Point, RoutingMode } from '../../model/types';

export interface EdgeGeometry {
  slots: Map<string, EdgeSlots>;
  pinSpan: Map<string, number>;
  routes: Map<string, Point[] | null>;
}

export function computeEdgeGeometry(model: Model, routing: RoutingMode): EdgeGeometry {
  const { slots, pinSpan } = pinSlots(model);
  if (routing === 'curved') return { slots, pinSpan, routes: new Map() };
  const { routes, slots: adjusted } = routeEdges(model, slots);
  return { slots: adjusted, pinSpan, routes };
}
```

`edge-path.ts` — port `drawEdge`'s path selection plus its private `curvePath` / `loopPath` / `headSub` / `headPath` **verbatim** from `render/draw-edge/draw-edge.ts` (`HEAD_LEN 8`, `HEAD_SPREAD 4`), swapping element writes for a returned object:

```ts
export function edgePath(model: Model, rel: Relationship, routing: RoutingMode, geometry: EdgeGeometry, live: boolean): EdgePathD {
  const { p1, p2, s, t, self, A } = edgeEndpoints(model, rel, geometry.slots.get(rel.id));
  let d: string;
  if (self) d = loopPath(p1, p2, A);
  else if (routing === 'curved') d = curvePath(p1, p2, s, t);
  else {
    const stored = geometry.routes.get(rel.id);
    const pts = !live && stored ? stored : simpleOrtho(p1, p2, s, t);
    d = routing === 'ortho' ? orthoPolyPath(pts) : smoothPath(pts);
  }
  return { d, head: headPath(rel, p1, p2, s, t, self) };
}
```

(Do NOT delete `render/draw-edge` yet — legacy engine still uses it until T16.)

- [ ] **Step 4: Run** new tests + full suite → PASS.
- [ ] **Step 5: Commit** — `feat(eer): pure edge geometry + path builders for the React scene`

---

### Task 6: pack-layout — pure

**Files:**
- Modify: `src/engine/layout/pack-layout/pack-layout.ts`, its test
- Modify: `src/engine/diagram/eer-diagram/eer-diagram.ts` (legacy call sites use the return value)

**Interfaces:**
- Produces: `packLayout(model: Model): Model` — returns a **new** model (new entity objects with fresh `x/y/_w/_h`, rebuilt `entityById`, new `_groupBounds`, new `_content`); the input is untouched. `relationships`/`groups`/`kinds` carry over by reference.

- [ ] **Step 1: Write the failing test** (add to `pack-layout.test.ts`):

```ts
it('returns a new packed model without mutating the input', () => {
  const { model } = loadModel(twoZoneRaw());
  const before = JSON.stringify(model!.entities.map((e) => [e.id, e.x, e.y, e._w, e._h]));
  const packed = packLayout(model!);
  expect(packed).not.toBe(model);
  expect(JSON.stringify(model!.entities.map((e) => [e.id, e.x, e.y, e._w, e._h]))).toBe(before);
  expect(packed.entities[0]).not.toBe(model!.entities[0]);
  expect(packed.entityById.get('users')).toBe(packed.entities.find((e) => e.id === 'users'));
  expect(packed._groupBounds.length).toBeGreaterThan(0);
});
```

(Existing determinism/geometry tests keep passing — `buildModel` already uses the return value.)

- [ ] **Step 2: Run** → FAIL (input mutated / same entity objects).

- [ ] **Step 3: Implement.** Clone at the top; the existing algorithm then mutates the clones freely — no other line changes:

```ts
export function packLayout(input: Model): Model {
  const entities = input.entities.map((e) => ({ ...e }));
  const model: Model = {
    ...input,
    entities,
    entityById: new Map(entities.map((e) => [e.id, e])),
    _groupBounds: [],
    _content: { w: 0, h: 0 },
  };
  // ... existing body unchanged, operating on `model` ...
  return model;
}
```

- [ ] **Step 4: Update legacy call sites** in `eer-diagram.ts`:
  - `load(model)`: `this.state.model = packLayout(model); buildScene(this.state); ...`. The fonts.ready guard `this.state.model !== model` breaks (identity changed) — replace with a load token: add `private loadToken = 0;`, increment at the top of `load()` into `const token = ++this.loadToken;`, guard with `if (this.destroyed || token !== this.loadToken) return;`, then `this.state.model = packLayout(this.state.model); relayout(this.state); this.fit();`.
  - `rearrange()`: `this.state.model = packLayout(this.state.model); relayout(this.state);`.

- [ ] **Step 5: Run** full suite + `pnpm typecheck` → PASS.
- [ ] **Step 6: Commit** — `refactor(eer): packLayout returns a fresh packed model (pure)`

---

### Task 7: Focus/visibility pure selectors

**Files:**
- Create (each with `{name}.ts` + `{name}.test.ts` + `index.ts`):
  - `src/engine/focus/related-to-entity/`
  - `src/engine/focus/related-to-group/`
  - `src/engine/focus/isolated-edge/`
  - `src/engine/focus/field-edges/`
  - `src/engine/focus/hidden-ids/`
  - `src/engine/focus/connected-ports/`

**Interfaces:**
- Consumes: `entityIdsInGroup`, `subgroupIdsOf`, `zoneIdOf`, `edgeSides`, `endKinds` (engine/model/end-kinds), `portKey`.
- Produces:

```ts
export interface RelatedSets { entities: Set<string>; edges: Set<string> }
export function relatedToEntity(model: Model, id: string): RelatedSets;
export interface GroupRelatedSets extends RelatedSets { litGroups: Set<string> }
export function relatedToGroup(model: Model, groupId: string): GroupRelatedSets;
export function isolatedEdge(model: Model, relId: string): RelatedSets;      // empty sets if rel unknown
export function fieldEdges(model: Model, entityId: string, field: string): Set<string>;
export interface HiddenIds { entities: Set<string>; groups: Set<string>; edges: Set<string> }
export function hiddenIds(model: Model, hiddenGroups: ReadonlySet<string>, hiddenKinds: ReadonlySet<string>): HiddenIds;
export function connectedPorts(model: Model, hiddenEdges: ReadonlySet<string>): Set<string>;  // portKey set — the visible 'one' ends
```

- [ ] **Step 1: Write failing tests** (one file per folder; representative assertions):

```ts
// related-to-entity.test.ts — port the set logic from the old focus-entity test
it('entity + neighbours + their edges', () => {
  const model = buildModel();
  const r = relatedToEntity(model, 'users');
  expect(r.entities).toEqual(new Set(['users', 'orders']));
  expect(r.edges).toEqual(new Set(['u-o', 'self']));
});

// related-to-group.test.ts
it('zone members, their partners, edges, and lit boxes incl subgroups', () => {
  const model = buildModel(nestedRaw());
  const r = relatedToGroup(model, 'z');
  expect(r.entities).toEqual(new Set(['loose', 'm1', 'm2']));
  expect(r.edges).toEqual(new Set(['m1-m2']));
  expect(r.litGroups).toEqual(new Set(['z', 's']));
});

// isolated-edge.test.ts
it('just the two endpoints and the edge; unknown rel → empty', () => {
  const model = buildModel();
  expect(isolatedEdge(model, 'u-o')).toEqual({ entities: new Set(['users', 'orders']), edges: new Set(['u-o']) });
  expect(isolatedEdge(model, 'nope').edges.size).toBe(0);
});

// field-edges.test.ts
it('edges touching one field on either end', () => {
  const model = buildModel();
  expect(fieldEdges(model, 'users', 'id')).toEqual(new Set(['u-o', 'self']));
  expect(fieldEdges(model, 'users', 'name').size).toBe(0);
});

// hidden-ids.test.ts — port assertions from the old apply-visibility test
it('hiding a zone hides its cards, boxes, and touching edges; kind filter hides edges only', () => {
  const model = buildModel();
  const h = hiddenIds(model, new Set(['z1']), new Set());
  expect(h.entities).toEqual(new Set(['users']));
  expect(h.groups).toEqual(new Set(['z1']));
  expect(h.edges).toEqual(new Set(['u-o', 'self']));
  const k = hiddenIds(model, new Set(), new Set(['fk']));
  expect(k.entities.size).toBe(0);
  expect(k.edges).toEqual(new Set(['u-o', 't-o', 'self']));
});

// connected-ports.test.ts — port the mark-connected-ports expectations
it('one-ends of visible edges are connected; hidden edges are not', () => {
  const model = buildModel();
  const all = connectedPorts(model, new Set());
  expect(all.size).toBeGreaterThan(0); // u-o & self: users.id side is the one-end
  const none = connectedPorts(model, new Set(model.relationships.map((r) => r.id)));
  expect(none.size).toBe(0);
});
```

- [ ] **Step 2: Run** → FAIL (modules missing).

- [ ] **Step 3: Implement** — port the set-computation halves of the legacy files, dropping every `classList` line:

```ts
// related-to-entity.ts  (from focus/focus-entity)
export function relatedToEntity(model: Model, id: string): RelatedSets {
  const entities = new Set<string>([id]);
  const edges = new Set<string>();
  for (const rel of model.relationships) {
    if (rel.source === id || rel.target === id) {
      edges.add(rel.id);
      entities.add(rel.source);
      entities.add(rel.target);
    }
  }
  return { entities, edges };
}

// related-to-group.ts  (from focus/focus-group)
export function relatedToGroup(model: Model, groupId: string): GroupRelatedSets {
  const inGroup = entityIdsInGroup(model, groupId);
  const entities = new Set<string>(inGroup);
  const edges = new Set<string>();
  for (const rel of model.relationships) {
    if (inGroup.has(rel.source) || inGroup.has(rel.target)) {
      edges.add(rel.id);
      entities.add(rel.source);
      entities.add(rel.target);
    }
  }
  return { entities, edges, litGroups: new Set([groupId, ...subgroupIdsOf(model, groupId)]) };
}

// isolated-edge.ts  (from focus/isolate-edge)
export function isolatedEdge(model: Model, relId: string): RelatedSets {
  const rel = model.relById.get(relId);
  if (!rel) return { entities: new Set(), edges: new Set() };
  return { entities: new Set([rel.source, rel.target]), edges: new Set([relId]) };
}

// field-edges.ts  (from focus/highlight-field)
export function fieldEdges(model: Model, entityId: string, field: string): Set<string> {
  const edges = new Set<string>();
  for (const rel of model.relationships) {
    if ((rel.source === entityId && rel.sourceField === field) || (rel.target === entityId && rel.targetField === field))
      edges.add(rel.id);
  }
  return edges;
}

// hidden-ids.ts  (from focus/apply-visibility)
export function hiddenIds(model: Model, hiddenGroups: ReadonlySet<string>, hiddenKinds: ReadonlySet<string>): HiddenIds {
  const zoneHidden = (groupId: string) => hiddenGroups.has(zoneIdOf(model, groupId));
  const entities = new Set<string>();
  for (const e of model.entities) if (zoneHidden(e.group)) entities.add(e.id);
  const groups = new Set<string>();
  for (const b of model._groupBounds) if (zoneHidden(b.id)) groups.add(b.id);
  const edges = new Set<string>();
  for (const rel of model.relationships) {
    const A = model.entityById.get(rel.source)!;
    const B = model.entityById.get(rel.target)!;
    if (zoneHidden(A.group) || zoneHidden(B.group) || (rel.kind ? hiddenKinds.has(rel.kind) : false)) edges.add(rel.id);
  }
  return { entities, groups, edges };
}

// connected-ports.ts  (from render/mark-connected-ports)
export function connectedPorts(model: Model, hiddenEdges: ReadonlySet<string>): Set<string> {
  const on = new Set<string>();
  for (const rel of model.relationships) {
    if (hiddenEdges.has(rel.id)) continue;
    const { s, t } = edgeSides(model, rel);
    const [ks, kt] = endKinds(rel.cardinality);
    if (ks === 'one') on.add(portKey(rel.source, rel.sourceField, s));
    if (kt === 'one') on.add(portKey(rel.target, rel.targetField, t));
  }
  return on;
}
```

(The legacy classList versions in `focus/` stay untouched until T16.)

- [ ] **Step 4: Run** new tests + full suite → PASS.
- [ ] **Step 5: Commit** — `feat(eer): pure focus/visibility selectors`

---

### Task 8: fit-view + search-model

**Files:**
- Create: `src/engine/layout/fit-view/{fit-view.ts,fit-view.test.ts,index.ts}`
- Create: `src/engine/search/search-model/{search-model.ts,search-model.test.ts,index.ts}`

**Interfaces:**
- Consumes: `Bounds` type from `engine/layout/visible-bounds`; `SearchResult` from `engine/model/types`.
- Produces:

```ts
// fit-view — math extracted verbatim from EerDiagram.fit()/centerOn()
export interface ViewTransform { zoom: number; panX: number; panY: number }
export function fitView(b: Bounds, vw: number, vh: number): ViewTransform;
export function centerOnPoint(cx: number, cy: number, vw: number, vh: number, zoom: number): { panX: number; panY: number };

// search-model — extracted verbatim from EerDiagram.search()
export function searchModel(model: Model, q: string): SearchResult[];  // trims, lowercases, caps at 20
```

- [ ] **Step 1: Write failing tests:**

```ts
// fit-view.test.ts
it('centers content and clamps zoom to [0.15, 1.6]', () => {
  const v = fitView({ minX: 0, minY: 0, maxX: 100, maxY: 100 }, 1000, 800);
  expect(v.zoom).toBe(1.6); // small content clamps high
  // content center maps to viewport center:
  expect(v.panX + 50 * v.zoom).toBeCloseTo(500, 5);
  expect(v.panY + 50 * v.zoom).toBeCloseTo(400, 5);
  const tiny = fitView({ minX: 0, minY: 0, maxX: 100000, maxY: 100 }, 1000, 800);
  expect(tiny.zoom).toBe(0.15); // huge content clamps low
});
it('centerOnPoint puts the point mid-viewport', () => {
  const p = centerOnPoint(200, 100, 1000, 800, 2);
  expect(p.panX).toBe(1000 / 2 - 200 * 2);
  expect(p.panY).toBe(800 / 2 - 100 * 2);
});

// search-model.test.ts — port the assertions from the eer-diagram search test
it('matches entities and fields, caps at 20, empty query → []', () => {
  const model = buildModel();
  expect(searchModel(model, '')).toEqual([]);
  const users = searchModel(model, 'users');
  expect(users.some((m) => m.kind === 'entity' && m.entityId === 'users')).toBe(true);
  expect(searchModel(model, 'id').every((m) => m.search.includes('id'))).toBe(true);
  // cap: build a 25-entity model (reuse the big-model builder from the old eer-diagram test)
  const big = buildModel({
    groups: [{ id: 'g', label: 'G' }],
    entities: Array.from({ length: 25 }, (_, i) => ({ id: 'e' + i, group: 'g', fields: [pkField] })),
    relationships: [],
  });
  expect(searchModel(big, 'e').length).toBe(20);
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** — copy the bodies out of `eer-diagram.ts`:

```ts
// fit-view.ts
const PAD = 56;
export function fitView(b: Bounds, vw: number, vh: number): ViewTransform {
  const bw = b.maxX - b.minX + PAD * 2;
  const bh = b.maxY - b.minY + PAD * 2;
  const zoom = Math.max(0.15, Math.min(vw / bw, vh / bh, 1.6));
  return { zoom, panX: (vw - bw * zoom) / 2 - (b.minX - PAD) * zoom, panY: (vh - bh * zoom) / 2 - (b.minY - PAD) * zoom };
}
export function centerOnPoint(cx: number, cy: number, vw: number, vh: number, zoom: number): { panX: number; panY: number } {
  return { panX: vw / 2 - cx * zoom, panY: vh / 2 - cy * zoom };
}

// search-model.ts — the exact index build + filter + .slice(0, 20) from EerDiagram.search
```

- [ ] **Step 4: Run** new tests + full suite → PASS.
- [ ] **Step 5: Commit** — `feat(eer): pure fitView/centerOnPoint and searchModel`

---

### Task 9: Diagram reducer (pure)

**Files:**
- Create: `src/state/diagram-reducer/{diagram-reducer.ts,diagram-reducer.test.ts,index.ts}`

**Interfaces:**
- Consumes: `packLayout` (T6 pure), `Model/Focus/Selection/RoutingMode` from engine types.
- Produces (later tasks import these exact names):

```ts
export type DiagramGesture =
  | { kind: 'idle' }
  | { kind: 'entity'; id: string }   // dragging one card
  | { kind: 'group' }                // dragging a group box
  | { kind: 'resize' };              // resizing a group box

export interface DiagramView { zoom: number; panX: number; panY: number; routing: RoutingMode }

export interface DiagramUi {
  panelSelection: Selection;                    // what the DetailPanel shows
  focus: Focus;                                 // what the canvas highlights
  hidden: { groups: ReadonlySet<string>; kinds: ReadonlySet<string> };
  colors: ReadonlyMap<string, string>;
  fieldHighlight: { entityId: string; field: string } | null;
  raisedEdge: string | null;                    // renders last → paints on top
  gesture: DiagramGesture;
}

export interface DiagramState { model: Model | null; view: DiagramView; ui: DiagramUi }
export const initialDiagramState: DiagramState;

export type DiagramAction =
  | { type: 'LOAD'; model: Model }
  | { type: 'REPACK' }                              // fonts.ready — keeps focus
  | { type: 'REARRANGE' }                           // toolbar — clears focus
  | { type: 'SET_VIEW'; view: Partial<Pick<DiagramView, 'zoom' | 'panX' | 'panY'>> }
  | { type: 'SET_ROUTING'; routing: RoutingMode }
  | { type: 'SET_COLORS'; colors: ReadonlyMap<string, string> }
  | { type: 'TOGGLE_GROUP'; id: string }
  | { type: 'TOGGLE_KIND'; id: string }
  | { type: 'SET_POSITIONS'; entities: { id: string; x: number; y: number }[]; boxes: { id: string; x: number; y: number }[] }
  | { type: 'RESIZE_GROUP'; id: string; x: number; y: number; w: number; h: number }
  | { type: 'SET_GESTURE'; gesture: DiagramGesture }
  | { type: 'SELECT_ENTITY'; id: string }
  | { type: 'SELECT_GROUP'; id: string }
  | { type: 'ISOLATE_EDGE'; id: string; silent?: boolean }
  | { type: 'FOCUS_FROM_SEARCH'; entityId: string; field?: string }
  | { type: 'HIGHLIGHT_FIELD'; entityId: string; field: string }
  | { type: 'CLEAR_FIELD_HIGHLIGHT' }
  | { type: 'RAISE_EDGE'; id: string }
  | { type: 'CLEAR_SELECTION' };

export function diagramReducer(state: DiagramState, action: DiagramAction): DiagramState;
```

Semantics that MUST match the legacy engine:
- `SELECT_ENTITY` → `focus = {type:'entity',id}`, `panelSelection = {type:'entity',id}`, `fieldHighlight = null`.
- `SELECT_GROUP` → `focus = {type:'group',id}`, `panelSelection = {type:'group',id}`.
- `ISOLATE_EDGE` → `focus = {type:'edge',id}`, `raisedEdge = id`; when `silent` the `panelSelection` is left unchanged (legacy `isolateSilent`: canvas isolates, panel keeps showing the entity/group).
- `FOCUS_FROM_SEARCH` → entity focus + panel selection + `fieldHighlight` set (or cleared when no field).
- `CLEAR_SELECTION` → `focus = null`, `panelSelection = {type:'none'}`, `fieldHighlight = null`, `raisedEdge = null`.
- `LOAD` → `model = packLayout(action.model)`, `view = { zoom: 1, panX: 0, panY: 0, routing: action.model.view.routing }`, ui fully reset.
- `REPACK` → `model = packLayout(model)` only (fonts re-measure; focus survives).
- `REARRANGE` → `model = packLayout(model)` + clear focus/panelSelection/raisedEdge (legacy `rearrange()` calls `clearFocus` + emits).
- `SET_POSITIONS` → structural sharing: only listed entities/boxes become new objects.

- [ ] **Step 1: Write the failing test** (`diagram-reducer.test.ts`):

```ts
import { buildModel } from '../../test/models';
import { diagramReducer, initialDiagramState, type DiagramState } from './diagram-reducer';

function loaded(): DiagramState {
  // buildModel returns a packed model; LOAD re-packs a copy — fine for tests
  return diagramReducer(initialDiagramState, { type: 'LOAD', model: buildModel() });
}

it('LOAD packs the model and resets view/ui', () => {
  const s = loaded();
  expect(s.model!._groupBounds.length).toBeGreaterThan(0);
  expect(s.view).toEqual({ zoom: 1, panX: 0, panY: 0, routing: 'avoid' }); // twoZoneRaw view.routing
  expect(s.ui.focus).toBeNull();
});

it('SET_POSITIONS shares structure: untouched entities keep identity', () => {
  const s = loaded();
  const before = s.model!;
  const s2 = diagramReducer(s, { type: 'SET_POSITIONS', entities: [{ id: 'users', x: 10, y: 20 }], boxes: [] });
  const users = s2.model!.entityById.get('users')!;
  expect(users.x).toBe(10);
  expect(users).not.toBe(before.entityById.get('users'));
  expect(s2.model!.entityById.get('tags')).toBe(before.entityById.get('tags'));
  expect(before.entityById.get('users')!.x).not.toBe(10); // old state untouched
});

it('SET_POSITIONS moves group boxes too', () => {
  const s = loaded();
  const b0 = s.model!._groupBounds[0]!;
  const s2 = diagramReducer(s, { type: 'SET_POSITIONS', entities: [], boxes: [{ id: b0.id, x: b0.x + 5, y: b0.y + 6 }] });
  expect(s2.model!._groupBounds[0]!.x).toBe(b0.x + 5);
  expect(s2.model!._groupBounds[1]).toBe(s.model!._groupBounds[1]);
});

it('RESIZE_GROUP rewrites one box', () => {
  const s = loaded();
  const id = s.model!._groupBounds[0]!.id;
  const s2 = diagramReducer(s, { type: 'RESIZE_GROUP', id, x: 1, y: 2, w: 300, h: 200 });
  expect(s2.model!._groupBounds.find((b) => b.id === id)).toMatchObject({ x: 1, y: 2, w: 300, h: 200 });
});

it('selection actions mirror the legacy engine', () => {
  let s = loaded();
  s = diagramReducer(s, { type: 'SELECT_ENTITY', id: 'users' });
  expect(s.ui.focus).toEqual({ type: 'entity', id: 'users' });
  expect(s.ui.panelSelection).toEqual({ type: 'entity', id: 'users' });
  s = diagramReducer(s, { type: 'ISOLATE_EDGE', id: 'u-o', silent: true });
  expect(s.ui.focus).toEqual({ type: 'edge', id: 'u-o' });
  expect(s.ui.panelSelection).toEqual({ type: 'entity', id: 'users' }); // silent keeps the panel
  expect(s.ui.raisedEdge).toBe('u-o');
  s = diagramReducer(s, { type: 'CLEAR_SELECTION' });
  expect(s.ui.focus).toBeNull();
  expect(s.ui.panelSelection).toEqual({ type: 'none' });
  expect(s.ui.raisedEdge).toBeNull();
});

it('REARRANGE clears focus, REPACK keeps it', () => {
  let s = loaded();
  s = diagramReducer(s, { type: 'SELECT_ENTITY', id: 'users' });
  const kept = diagramReducer(s, { type: 'REPACK' });
  expect(kept.ui.focus).toEqual({ type: 'entity', id: 'users' });
  const cleared = diagramReducer(s, { type: 'REARRANGE' });
  expect(cleared.ui.focus).toBeNull();
});

it('TOGGLE_GROUP / TOGGLE_KIND flip set membership immutably', () => {
  let s = loaded();
  s = diagramReducer(s, { type: 'TOGGLE_GROUP', id: 'z1' });
  expect(s.ui.hidden.groups.has('z1')).toBe(true);
  s = diagramReducer(s, { type: 'TOGGLE_GROUP', id: 'z1' });
  expect(s.ui.hidden.groups.has('z1')).toBe(false);
});

it('FOCUS_FROM_SEARCH sets focus + field highlight', () => {
  const s = diagramReducer(loaded(), { type: 'FOCUS_FROM_SEARCH', entityId: 'users', field: 'id' });
  expect(s.ui.focus).toEqual({ type: 'entity', id: 'users' });
  expect(s.ui.fieldHighlight).toEqual({ entityId: 'users', field: 'id' });
});
```

- [ ] **Step 2: Run** `pnpm exec vitest run src/state` → FAIL (module missing).

- [ ] **Step 3: Implement** `diagram-reducer.ts`:

```ts
// Pure reducer — the single owner of diagram state. Every update is immutable
// with structural sharing so memoized scene components skip untouched nodes.

import { packLayout } from '../../engine/layout/pack-layout';
import type { Focus, Model, RoutingMode, Selection } from '../../engine/model/types';

// ... (type declarations exactly as in the Interfaces block above)

export const initialDiagramState: DiagramState = {
  model: null,
  view: { zoom: 1, panX: 0, panY: 0, routing: 'curved' },
  ui: {
    panelSelection: { type: 'none' },
    focus: null,
    hidden: { groups: new Set(), kinds: new Set() },
    colors: new Map(),
    fieldHighlight: null,
    raisedEdge: null,
    gesture: { kind: 'idle' },
  },
};

function toggled(set: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

function withPositions(model: Model, ents: { id: string; x: number; y: number }[], boxes: { id: string; x: number; y: number }[]): Model {
  let entities = model.entities;
  let entityById = model.entityById;
  if (ents.length) {
    const moved = new Map(ents.map((m) => [m.id, m]));
    entities = model.entities.map((e) => {
      const m = moved.get(e.id);
      return m ? { ...e, x: m.x, y: m.y } : e;
    });
    entityById = new Map(entities.map((e) => [e.id, e]));
  }
  let groupBounds = model._groupBounds;
  if (boxes.length) {
    const movedB = new Map(boxes.map((b) => [b.id, b]));
    groupBounds = model._groupBounds.map((b) => {
      const m = movedB.get(b.id);
      return m ? { ...b, x: m.x, y: m.y } : b;
    });
  }
  return { ...model, entities, entityById, _groupBounds: groupBounds };
}

export function diagramReducer(state: DiagramState, action: DiagramAction): DiagramState {
  switch (action.type) {
    case 'LOAD':
      return {
        model: packLayout(action.model),
        view: { zoom: 1, panX: 0, panY: 0, routing: action.model.view.routing },
        ui: { ...initialDiagramState.ui, hidden: { groups: new Set(), kinds: new Set() }, colors: new Map() },
      };
    case 'REPACK':
      return state.model ? { ...state, model: packLayout(state.model) } : state;
    case 'REARRANGE':
      return state.model
        ? {
            ...state,
            model: packLayout(state.model),
            ui: { ...state.ui, focus: null, panelSelection: { type: 'none' }, fieldHighlight: null, raisedEdge: null },
          }
        : state;
    case 'SET_VIEW':
      return { ...state, view: { ...state.view, ...action.view } };
    case 'SET_ROUTING':
      return { ...state, view: { ...state.view, routing: action.routing } };
    case 'SET_COLORS':
      return { ...state, ui: { ...state.ui, colors: action.colors } };
    case 'TOGGLE_GROUP':
      return { ...state, ui: { ...state.ui, hidden: { ...state.ui.hidden, groups: toggled(state.ui.hidden.groups, action.id) } } };
    case 'TOGGLE_KIND':
      return { ...state, ui: { ...state.ui, hidden: { ...state.ui.hidden, kinds: toggled(state.ui.hidden.kinds, action.id) } } };
    case 'SET_POSITIONS':
      return state.model ? { ...state, model: withPositions(state.model, action.entities, action.boxes) } : state;
    case 'RESIZE_GROUP':
      return state.model
        ? {
            ...state,
            model: {
              ...state.model,
              _groupBounds: state.model._groupBounds.map((b) =>
                b.id === action.id ? { ...b, x: action.x, y: action.y, w: action.w, h: action.h } : b,
              ),
            },
          }
        : state;
    case 'SET_GESTURE':
      return { ...state, ui: { ...state.ui, gesture: action.gesture } };
    case 'SELECT_ENTITY':
      return {
        ...state,
        ui: { ...state.ui, focus: { type: 'entity', id: action.id }, panelSelection: { type: 'entity', id: action.id }, fieldHighlight: null },
      };
    case 'SELECT_GROUP':
      return { ...state, ui: { ...state.ui, focus: { type: 'group', id: action.id }, panelSelection: { type: 'group', id: action.id } } };
    case 'ISOLATE_EDGE':
      return {
        ...state,
        ui: {
          ...state.ui,
          focus: { type: 'edge', id: action.id },
          raisedEdge: action.id,
          panelSelection: action.silent ? state.ui.panelSelection : { type: 'edge', id: action.id },
        },
      };
    case 'FOCUS_FROM_SEARCH':
      return {
        ...state,
        ui: {
          ...state.ui,
          focus: { type: 'entity', id: action.entityId },
          panelSelection: { type: 'entity', id: action.entityId },
          fieldHighlight: action.field ? { entityId: action.entityId, field: action.field } : null,
        },
      };
    case 'HIGHLIGHT_FIELD':
      return { ...state, ui: { ...state.ui, fieldHighlight: { entityId: action.entityId, field: action.field } } };
    case 'CLEAR_FIELD_HIGHLIGHT':
      return state.ui.fieldHighlight ? { ...state, ui: { ...state.ui, fieldHighlight: null } } : state;
    case 'RAISE_EDGE':
      return { ...state, ui: { ...state.ui, raisedEdge: action.id } };
    case 'CLEAR_SELECTION':
      return {
        ...state,
        ui: { ...state.ui, focus: null, panelSelection: { type: 'none' }, fieldHighlight: null, raisedEdge: null },
      };
  }
}
```

- [ ] **Step 4: Run** `pnpm exec vitest run src/state` + full suite → PASS.
- [ ] **Step 5: Commit** — `feat(eer): diagram state reducer`

---

### Task 10: DiagramProvider, contexts, actions, derived geometry, test render helper

**Files:**
- Create: `src/state/diagram-context.ts` (contexts + hooks; no component → plain file, no folder needed)
- Create: `src/state/diagram-provider/{diagram-provider.tsx,diagram-provider.test.tsx,index.ts}`
- Create: `src/test/render.tsx` (RTL helper used by every component test from here on)

**Interfaces:**
- Consumes: `diagramReducer/initialDiagramState/DiagramState/DiagramAction/DiagramView/DiagramUi/DiagramGesture` (T9), `computeEdgeGeometry/EdgeGeometry` (T5), `fitView/centerOnPoint` (T8), `searchModel` (T8), `visibleBounds`, `loadModel` types.
- Produces:

```ts
// diagram-context.ts — hooks components use (each throws outside the provider):
export function useDiagramModel(): Model;            // non-null; scene renders only when loaded
export function useDiagramModelOrNull(): Model | null;
export function useDiagramView(): DiagramView;
export function useDiagramUi(): DiagramUi;
export function useDiagramGeometry(): EdgeGeometry;
export function useDiagramDispatch(): (a: DiagramAction) => void;
export function useDiagramActions(): DiagramActions;
export function useViewportRef(): RefObject<HTMLDivElement | null>;

// diagram-provider.tsx
export function DiagramProvider({ children }: { children: ReactNode }): JSX.Element;
export interface DiagramActions {
  fit(): void;
  centerOn(entityId: string): void;
  rearrange(): void;                 // REARRANGE + fit
  setRouting(mode: RoutingMode): void;
  setColors(colors: ReadonlyMap<string, string>): void;
  toggleGroup(id: string): void;
  toggleKind(id: string): void;
  selectEntity(id: string): void;
  selectGroup(id: string): void;
  isolate(relId: string): void;
  isolateSilent(relId: string): void;
  focusFromSearch(entityId: string, field?: string): void;
  clearSelection(): void;
  search(q: string): SearchResult[];
  runChecks(): CheckResult[];        // wired in T14/T15; until then returns []
  load(model: Model): void;          // dispatch LOAD + double-rAF fit
  repackAndFit(): void;              // REPACK + fit (fonts.ready)
}
```

- [ ] **Step 1: Write the failing test** (`diagram-provider.test.tsx`):

```tsx
import { render, screen, act } from '@testing-library/react';
import { DiagramProvider } from './diagram-provider';
import { useDiagramActions, useDiagramModelOrNull, useDiagramUi, useDiagramGeometry } from '../diagram-context';
import { buildModel } from '../../test/models';

function Probe() {
  const model = useDiagramModelOrNull();
  const ui = useDiagramUi();
  const geometry = useDiagramGeometry();
  const actions = useDiagramActions();
  return (
    <div>
      <span data-testid="n">{model ? model.entities.length : 0}</span>
      <span data-testid="focus">{ui.focus?.id ?? 'none'}</span>
      <span data-testid="routes">{geometry.routes.size}</span>
      <button onClick={() => actions.load(buildModel())}>load</button>
      <button onClick={() => actions.selectEntity('users')}>sel</button>
      <button onClick={() => actions.setRouting('curved')}>curved</button>
    </div>
  );
}

it('provider loads a model, exposes slices, derives geometry', async () => {
  render(<DiagramProvider><Probe /></DiagramProvider>);
  expect(screen.getByTestId('n').textContent).toBe('0');
  await act(async () => screen.getByText('load').click());
  expect(screen.getByTestId('n').textContent).toBe('3');
  expect(Number(screen.getByTestId('routes').textContent)).toBeGreaterThan(0); // twoZoneRaw routing=avoid
  await act(async () => screen.getByText('curved').click());
  expect(screen.getByTestId('routes').textContent).toBe('0');
  await act(async () => screen.getByText('sel').click());
  expect(screen.getByTestId('focus').textContent).toBe('users');
});

it('search + isolateSilent behave like the legacy engine', async () => {
  let captured: ReturnType<typeof useDiagramActions> | null = null;
  let ui: ReturnType<typeof useDiagramUi> | null = null;
  function Grab() { captured = useDiagramActions(); ui = useDiagramUi(); return null; }
  render(<DiagramProvider><Grab /></DiagramProvider>);
  await act(async () => captured!.load(buildModel()));
  expect(captured!.search('users').length).toBeGreaterThan(0);
  await act(async () => captured!.selectEntity('users'));
  await act(async () => captured!.isolateSilent('u-o'));
  expect(ui!.focus).toEqual({ type: 'edge', id: 'u-o' });
  expect(ui!.panelSelection).toEqual({ type: 'entity', id: 'users' });
});
```

Add to the test setup (or this file) a rAF polyfill if missing:

```ts
if (!('requestAnimationFrame' in globalThis)) {
  (globalThis as { requestAnimationFrame?: (cb: FrameRequestCallback) => number }).requestAnimationFrame = (cb) => setTimeout(() => cb(0), 0) as unknown as number;
}
```

- [ ] **Step 2: Run** `pnpm exec vitest run src/state` → FAIL.

- [ ] **Step 3: Implement.**

`diagram-context.ts`:

```ts
// Slice contexts so memoized scene components only re-render for their slice.
// The provider (diagram-provider.tsx) is the only writer.

import { createContext, useContext, type RefObject } from 'react';
import type { Model } from '../engine/model/types';
import type { EdgeGeometry } from '../engine/routing/edge-geometry';
import type { DiagramAction, DiagramUi, DiagramView } from './diagram-reducer';
import type { DiagramActions } from './diagram-provider/diagram-provider';

export const ModelContext = createContext<Model | null>(null);
export const ViewContext = createContext<DiagramView | null>(null);
export const UiContext = createContext<DiagramUi | null>(null);
export const GeometryContext = createContext<EdgeGeometry | null>(null);
export const DispatchContext = createContext<((a: DiagramAction) => void) | null>(null);
export const ActionsContext = createContext<DiagramActions | null>(null);
export const ViewportRefContext = createContext<RefObject<HTMLDivElement | null> | null>(null);

function req<T>(v: T | null, name: string): T {
  if (v === null) throw new Error(name + ' used outside <DiagramProvider>');
  return v;
}

export function useDiagramModelOrNull(): Model | null { return useContext(ModelContext); }
export function useDiagramModel(): Model { return req(useContext(ModelContext), 'useDiagramModel'); }
export function useDiagramView(): DiagramView { return req(useContext(ViewContext), 'useDiagramView'); }
export function useDiagramUi(): DiagramUi { return req(useContext(UiContext), 'useDiagramUi'); }
export function useDiagramGeometry(): EdgeGeometry { return req(useContext(GeometryContext), 'useDiagramGeometry'); }
export function useDiagramDispatch() { return req(useContext(DispatchContext), 'useDiagramDispatch'); }
export function useDiagramActions(): DiagramActions { return req(useContext(ActionsContext), 'useDiagramActions'); }
export function useViewportRef() { return req(useContext(ViewportRefContext), 'useViewportRef'); }
```

(Note: `ViewContext`/`UiContext` hold non-null values once the provider mounts — the null is only the out-of-provider default.)

`diagram-provider/diagram-provider.tsx`:

```tsx
// Owns the reducer, derives edge geometry (frozen mid-gesture, exactly like the
// legacy live redraw), and packages the imperative surface (fit/search/checks)
// that needs the latest state + viewport element.

import { useMemo, useReducer, useRef, useEffect, type ReactNode } from 'react';
import { computeEdgeGeometry, type EdgeGeometry } from '../../engine/routing/edge-geometry';
import { centerOnPoint, fitView } from '../../engine/layout/fit-view';
import { searchModel } from '../../engine/search/search-model';
import { visibleBounds } from '../../engine/layout/visible-bounds';
import { diagramReducer, initialDiagramState } from '../diagram-reducer';
import type { CheckResult, Model, RoutingMode, SearchResult } from '../../engine/model/types';
import {
  ActionsContext, DispatchContext, GeometryContext, ModelContext, UiContext, ViewContext, ViewportRefContext,
} from '../diagram-context';

export interface DiagramActions { /* copy the exact 17-method shape from this task's Interfaces block */ }

const EMPTY_GEOMETRY: EdgeGeometry = { slots: new Map(), pinSpan: new Map(), routes: new Map() };

export function DiagramProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(diagramReducer, initialDiagramState);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  // Latest state for imperative actions (search/fit/checks read outside render).
  const stateRef = useRef(state);
  stateRef.current = state;

  // Derived edge geometry — frozen while a gesture is in flight (legacy `live`
  // redraws kept slots/routes from before the drag; full recompute lands on release).
  const frozen = state.ui.gesture.kind !== 'idle';
  const lastGeometry = useRef<EdgeGeometry | null>(null);
  const geometry = useMemo(() => {
    if (!state.model) return EMPTY_GEOMETRY;
    if (frozen && lastGeometry.current) return lastGeometry.current;
    const g = computeEdgeGeometry(state.model, state.view.routing);
    lastGeometry.current = g;
    return g;
  }, [state.model, state.view.routing, frozen]);
  const geometryRef = useRef(geometry);
  geometryRef.current = geometry;

  const actions = useMemo<DiagramActions>(() => {
    const fit = () => {
      const s = stateRef.current;
      const vp = viewportRef.current;
      if (!s.model || !vp) return;
      dispatch({ type: 'SET_VIEW', view: fitView(visibleBounds(s.model, s.ui.hidden.groups), vp.clientWidth, vp.clientHeight) });
    };
    const centerOn = (entityId: string) => {
      const s = stateRef.current;
      const vp = viewportRef.current;
      const e = s.model?.entityById.get(entityId);
      if (!e || !vp) return;
      dispatch({ type: 'SET_VIEW', view: centerOnPoint(e.x + e._w / 2, e.y + e._h / 2, vp.clientWidth, vp.clientHeight, s.view.zoom) });
    };
    return {
      fit,
      centerOn,
      rearrange: () => { dispatch({ type: 'REARRANGE' }); fit(); },
      setRouting: (mode: RoutingMode) => dispatch({ type: 'SET_ROUTING', routing: mode }),
      setColors: (colors) => dispatch({ type: 'SET_COLORS', colors }),
      toggleGroup: (id) => dispatch({ type: 'TOGGLE_GROUP', id }),
      toggleKind: (id) => dispatch({ type: 'TOGGLE_KIND', id }),
      selectEntity: (id) => dispatch({ type: 'SELECT_ENTITY', id }),
      selectGroup: (id) => dispatch({ type: 'SELECT_GROUP', id }),
      isolate: (relId) => dispatch({ type: 'ISOLATE_EDGE', id: relId }),
      isolateSilent: (relId) => dispatch({ type: 'ISOLATE_EDGE', id: relId, silent: true }),
      focusFromSearch: (entityId, field) => { dispatch({ type: 'FOCUS_FROM_SEARCH', entityId, field }); centerOn(entityId); },
      clearSelection: () => dispatch({ type: 'CLEAR_SELECTION' }),
      search: (q: string): SearchResult[] => (stateRef.current.model ? searchModel(stateRef.current.model, q) : []),
      runChecks: (): CheckResult[] => [], // replaced in T15 once run-checks is re-signatured (T14)
      load: (model: Model) => {
        dispatch({ type: 'LOAD', model });
        // Fit after layout settles (grid/scrollbars finalize a frame late) — legacy double-rAF.
        requestAnimationFrame(() => requestAnimationFrame(fit));
      },
      repackAndFit: () => { dispatch({ type: 'REPACK' }); fit(); },
    };
  }, []);

  // DEV handle for browser verification (replaces window.__eer = EerDiagram).
  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as unknown as { __eer: unknown }).__eer = {
        getState: () => stateRef.current,
        getGeometry: () => geometryRef.current,
        dispatch,
        actions,
      };
    }
  }, [actions]);

  return (
    <ModelContext.Provider value={state.model}>
      <ViewContext.Provider value={state.view}>
        <UiContext.Provider value={state.ui}>
          <GeometryContext.Provider value={geometry}>
            <DispatchContext.Provider value={dispatch}>
              <ActionsContext.Provider value={actions}>
                <ViewportRefContext.Provider value={viewportRef}>{children}</ViewportRefContext.Provider>
              </ActionsContext.Provider>
            </DispatchContext.Provider>
          </GeometryContext.Provider>
        </UiContext.Provider>
      </ViewContext.Provider>
    </ModelContext.Provider>
  );
}
```

In T14/T15 `runChecks` gets its real body — the plan calls it out again there so this stub never ships to the final state.

`src/test/render.tsx` (shared RTL helper — replaces `test/scene.ts` use for NEW tests; scene.ts itself stays until T16):

```tsx
// Render helpers for component tests: a loaded DiagramProvider around arbitrary UI.

import { act, render, type RenderResult } from '@testing-library/react';
import type { ReactNode } from 'react';
import { DiagramProvider } from '../state/diagram-provider';
import { useDiagramActions, type DiagramActions } from '../state/diagram-provider/diagram-provider';
import { buildModel } from './models';

if (!('requestAnimationFrame' in globalThis)) {
  (globalThis as { requestAnimationFrame?: (cb: FrameRequestCallback) => number }).requestAnimationFrame = (cb) =>
    setTimeout(() => cb(0), 0) as unknown as number;
}

let grabbed: DiagramActions | null = null;
function Grab() { grabbed = useDiagramActions(); return null; }

export async function renderDiagram(ui: ReactNode, raw?: unknown): Promise<RenderResult & { actions: DiagramActions }> {
  const result = render(
    <DiagramProvider>
      <Grab />
      {ui}
    </DiagramProvider>,
  );
  await act(async () => grabbed!.load(buildModel(raw)));
  return Object.assign(result, { actions: grabbed! });
}
```

(Export `useDiagramActions`'s `DiagramActions` type from the provider's `index.ts` alongside `DiagramProvider`.)

- [ ] **Step 4: Run** `pnpm exec vitest run src/state` + full suite → PASS. `pnpm typecheck` clean.
- [ ] **Step 5: Commit** — `feat(eer): DiagramProvider with slice contexts, actions and derived edge geometry`

---

### Task 11: Scene components — World, ZoneBoxes, EntityCards

**Files:**
- Create: `src/components/diagram/world/{world.tsx,world.test.tsx,index.ts}`
- Create: `src/components/diagram/zone-boxes/{zone-boxes.tsx,zone-boxes.test.tsx,index.ts}`
- Create: `src/components/diagram/entity-cards/{entity-cards.tsx,entity-card.tsx,field-row.tsx,use-focus-sets.ts,use-hidden-ids.ts,entity-cards.test.tsx,index.ts}` (index exports `EntityCards`, `useFocusSets`, `useHiddenIds` — the hooks are shared with ZoneBoxes here and EdgesSvg in T12; import them via the folder index)

**Interfaces:**
- Consumes: context hooks (T10), selectors (T7), `entityColor/groupColor` (T1), `portKey`, `EdgeGeometry.pinSpan` (T5).
- Produces: `<World>{children}</World>` (`.world` div with the view transform) · `<ZoneBoxes />` (`.layer.groups`) · `<EntityCards />` (`.layer.cards`) · `useFocusSets(): (RelatedSets & { litGroups?: Set<string> }) | null`.

- [ ] **Step 1: Write failing tests** (`world.test.tsx`, `zone-boxes.test.tsx`, `entity-cards.test.tsx`), all via `renderDiagram`:

```tsx
// world.test.tsx
it('applies the view transform and updates on SET_VIEW', async () => {
  const { container, actions } = await renderDiagram(<World><span /></World>);
  const world = container.querySelector('.world') as HTMLElement;
  expect(world.style.transform).toMatch(/translate\(.+\) scale\(/);
  await act(async () => actions.setRouting('curved')); // unrelated slice → transform unchanged
  const before = world.style.transform;
  await act(async () => actions.centerOn('users')); // jsdom viewport is 0×0 but pan still changes
  expect(world.style.transform).not.toBe(before);
});

// zone-boxes.test.tsx
it('renders one .zone per group bound with parity attrs', async () => {
  const { container } = await renderDiagram(<ZoneBoxes />, nestedRaw());
  const zones = container.querySelectorAll('.zone');
  expect(zones.length).toBe(2);
  const sub = container.querySelector('.zone-sub') as HTMLElement;
  expect(sub.dataset.group).toBe('s');
  expect(sub.dataset.parent).toBe('z');
  expect(sub.style.getPropertyValue('--group-c')).toBeTruthy();
  expect(sub.querySelector('.zone-label')!.textContent).toBe('Sub');
});
it('group focus: selected box, others dim; hidden zone gets hidden', async () => {
  const { container, actions } = await renderDiagram(<ZoneBoxes />);
  await act(async () => actions.selectGroup('z1'));
  expect(container.querySelector('.zone[data-group="z1"]')!.classList.contains('zone-selected')).toBe(true);
  expect(container.querySelector('.zone[data-group="z2"]')!.classList.contains('zone-dim')).toBe(true);
  await act(async () => actions.clearSelection());
  await act(async () => actions.toggleGroup('z1'));
  expect(container.querySelector('.zone[data-group="z1"]')!.classList.contains('hidden')).toBe(true);
});

// entity-cards.test.tsx
it('renders parity card DOM: header, rows, badges, port pairs', async () => {
  const { container } = await renderDiagram(<EntityCards />);
  const card = container.querySelector('.card[data-entity="users"]') as HTMLElement;
  expect(card.querySelector('.card-title')!.textContent).toBe('users');
  expect(card.style.transform).toMatch(/translate\(/);
  expect(card.style.getPropertyValue('--entity-c')).toBeTruthy();
  const rows = card.querySelectorAll('.field');
  expect(rows.length).toBe(3);
  const pk = rows[0] as HTMLElement;
  expect(pk.classList.contains('role-pk')).toBe(true);
  expect(pk.dataset.index).toBe('0');
  expect(pk.querySelectorAll('.port.left').length).toBe(1);
  expect(pk.querySelectorAll('.port.right').length).toBe(1);
  expect((pk.querySelector('.port.left') as HTMLElement).dataset.side).toBe('L');
});
it('focus dims non-related and rings the selected card', async () => {
  const { container, actions } = await renderDiagram(<EntityCards />);
  await act(async () => actions.selectEntity('users'));
  const users = container.querySelector('.card[data-entity="users"]')!;
  const tags = container.querySelector('.card[data-entity="tags"]')!;
  expect(users.classList.contains('selected')).toBe(true);
  expect(users.classList.contains('focus')).toBe(true);
  expect(tags.classList.contains('dim')).toBe(true);
});
it('connected one-end ports get .connected; fan spans size the pin bar', async () => {
  const { container } = await renderDiagram(<EntityCards />);
  // users.id feeds u-o (1-n → source is the one end) and self — its R port is connected + fanned
  const port = container.querySelector('.port.right[data-entity="users"][data-field="id"]') as HTMLElement;
  expect(port.classList.contains('connected')).toBe(true);
  expect(port.style.height).not.toBe(''); // 2 ends share the pin → span > 0
});
it('field hover highlights + dispatches; hiding a zone hides its cards', async () => {
  const { container, actions } = await renderDiagram(<EntityCards />);
  const row = container.querySelector('.field[data-entity="users"][data-field="id"]') as HTMLElement;
  fireEvent.mouseEnter(row);
  expect(row.classList.contains('hot')).toBe(true);
  fireEvent.mouseLeave(row);
  expect(row.classList.contains('hot')).toBe(false);
  await act(async () => actions.toggleGroup('z1'));
  expect(container.querySelector('.card[data-entity="users"]')!.classList.contains('hidden')).toBe(true);
});
```

- [ ] **Step 2: Run** `pnpm exec vitest run src/components/diagram` → FAIL.

- [ ] **Step 3: Implement.**

`world/world.tsx`:

```tsx
import type { ReactNode } from 'react';
import { useDiagramView } from '../../../state/diagram-context';

export function World({ children }: { children: ReactNode }) {
  const v = useDiagramView();
  return (
    <div className="world" style={{ transform: `translate(${v.panX}px, ${v.panY}px) scale(${v.zoom})` }}>
      {children}
    </div>
  );
}
```

`entity-cards/use-focus-sets.ts` (shared by cards, zones, and edges):

```ts
// Which entities/edges stay lit for the current canvas focus — memoized pure sets.

import { useMemo } from 'react';
import { isolatedEdge } from '../../../engine/focus/isolated-edge';
import { relatedToEntity } from '../../../engine/focus/related-to-entity';
import { relatedToGroup, type GroupRelatedSets } from '../../../engine/focus/related-to-group';
import type { RelatedSets } from '../../../engine/focus/related-to-entity';
import { useDiagramModel, useDiagramUi } from '../../../state/diagram-context';

export function useFocusSets(): (RelatedSets & Partial<Pick<GroupRelatedSets, 'litGroups'>>) | null {
  const model = useDiagramModel();
  const focus = useDiagramUi().focus;
  return useMemo(() => {
    if (!focus) return null;
    if (focus.type === 'entity') return relatedToEntity(model, focus.id);
    if (focus.type === 'group') return relatedToGroup(model, focus.id);
    return isolatedEdge(model, focus.id);
  }, [model, focus]);
}
```

Also create `entity-cards/use-hidden-ids.ts` (same folder, exported from index alongside the hook above):

```ts
import { useMemo } from 'react';
import { hiddenIds, type HiddenIds } from '../../../engine/focus/hidden-ids';
import { useDiagramModel, useDiagramUi } from '../../../state/diagram-context';

export function useHiddenIds(): HiddenIds {
  const model = useDiagramModel();
  const hidden = useDiagramUi().hidden;
  return useMemo(() => hiddenIds(model, hidden.groups, hidden.kinds), [model, hidden]);
}
```

`zone-boxes/zone-boxes.tsx`:

```tsx
import type { CSSProperties } from 'react';
import { groupColor } from '../../../engine/colors/group-color';
import { useDiagramModel, useDiagramUi } from '../../../state/diagram-context';
import { useFocusSets, useHiddenIds } from '../entity-cards';

export function ZoneBoxes() {
  const model = useDiagramModel();
  const ui = useDiagramUi();
  const focusSets = useFocusSets();
  const hidden = useHiddenIds();
  const groupFocusId = ui.focus?.type === 'group' ? ui.focus.id : null;
  const lit = groupFocusId ? (focusSets?.litGroups ?? null) : null;
  return (
    <div className="layer groups">
      {model._groupBounds.map((b) => {
        const cls = [
          'zone',
          b.level > 0 && 'zone-sub',
          groupFocusId === b.id && 'zone-selected',
          lit && !lit.has(b.id) && 'zone-dim',
          hidden.groups.has(b.id) && 'hidden',
        ].filter(Boolean).join(' ');
        return (
          <div
            key={b.id}
            className={cls}
            data-group={b.id}
            data-parent={b.parent ?? undefined}
            style={{ left: b.x, top: b.y, width: b.w, height: b.h, '--group-c': groupColor(model, b.id, ui.colors) } as CSSProperties}
          >
            <div className="zone-label">{b.label}</div>
          </div>
        );
      })}
    </div>
  );
}
```

`entity-cards/entity-cards.tsx`:

```tsx
import { useMemo } from 'react';
import { connectedPorts } from '../../../engine/focus/connected-ports';
import { entityColor } from '../../../engine/colors/entity-color';
import { useDiagramGeometry, useDiagramModel, useDiagramUi } from '../../../state/diagram-context';
import { EntityCard } from './entity-card';
import { useFocusSets } from './use-focus-sets';
import { useHiddenIds } from './use-hidden-ids';

export function EntityCards() {
  const model = useDiagramModel();
  const ui = useDiagramUi();
  const geometry = useDiagramGeometry();
  const focusSets = useFocusSets();
  const hidden = useHiddenIds();
  const connected = useMemo(() => connectedPorts(model, hidden.edges), [model, hidden.edges]);
  return (
    <div className="layer cards">
      {model.entities.map((e) => {
        const related = focusSets?.entities.has(e.id) ?? false;
        return (
          <EntityCard
            key={e.id}
            entity={e}
            color={entityColor(model, e.id, ui.colors)}
            dim={!!focusSets && !related}
            focus={!!focusSets && related}
            selected={ui.focus?.type === 'entity' && ui.focus.id === e.id}
            hidden={hidden.entities.has(e.id)}
            connected={connected}
            pinSpan={geometry.pinSpan}
          />
        );
      })}
    </div>
  );
}
```

`entity-cards/entity-card.tsx` (memo; primitives + stable maps as props):

```tsx
import { memo, type CSSProperties } from 'react';
import type { Entity } from '../../../engine/model/types';
import { FieldRow } from './field-row';

interface EntityCardProps {
  entity: Entity;
  color: string;
  dim: boolean;
  focus: boolean;
  selected: boolean;
  hidden: boolean;
  connected: ReadonlySet<string>;
  pinSpan: ReadonlyMap<string, number>;
}

export const EntityCard = memo(function EntityCard(p: EntityCardProps) {
  const e = p.entity;
  const cls = ['card', p.dim && 'dim', p.focus && 'focus', p.selected && 'selected', p.hidden && 'hidden']
    .filter(Boolean).join(' ');
  return (
    <div
      className={cls}
      data-entity={e.id}
      data-group={e.group}
      style={{ width: e._w, transform: `translate(${e.x}px, ${e.y}px)`, '--entity-c': p.color } as CSSProperties}
    >
      <div className="card-hd"><span className="card-title">{e.label}</span></div>
      <div className="card-body">
        {e.fields.map((f, i) => (
          <FieldRow key={f.name} entity={e} field={f} index={i} connected={p.connected} pinSpan={p.pinSpan} />
        ))}
      </div>
    </div>
  );
});
```

`entity-cards/field-row.tsx` (private — not in index):

```tsx
import { useState } from 'react';
import { portKey } from '../../../engine/geometry/port-key';
import { useDiagramDispatch } from '../../../state/diagram-context';
import type { Entity, Field, Side } from '../../../engine/model/types';

function Port({ e, f, side, connected, pinSpan }: {
  e: Entity; f: Field; side: Side; connected: ReadonlySet<string>; pinSpan: ReadonlyMap<string, number>;
}) {
  const key = portKey(e.id, f.name, side);
  const off = pinSpan.get(key) ?? 0;
  return (
    <span
      className={'port ' + (side === 'L' ? 'left' : 'right') + (connected.has(key) ? ' connected' : '')}
      data-entity={e.id}
      data-field={f.name}
      data-side={side}
      style={off > 0 ? { height: 2 * off + 11 } : undefined}
    />
  );
}

export function FieldRow({ entity: e, field: f, index, connected, pinSpan }: {
  entity: Entity; field: Field; index: number; connected: ReadonlySet<string>; pinSpan: ReadonlyMap<string, number>;
}) {
  const dispatch = useDiagramDispatch();
  const [hot, setHot] = useState(false);
  return (
    <div
      className={'field' + (f.role ? ' role-' + f.role : '') + (hot ? ' hot' : '')}
      data-entity={e.id}
      data-field={f.name}
      data-index={String(index)}
      onMouseEnter={() => { setHot(true); dispatch({ type: 'HIGHLIGHT_FIELD', entityId: e.id, field: f.name }); }}
      onMouseLeave={() => { setHot(false); dispatch({ type: 'CLEAR_FIELD_HIGHLIGHT' }); }}
    >
      <span className="badge">{f.role ? f.role.toUpperCase() : ''}</span>
      <span className="fname">{f.name}</span>
      <span className="ftype">{f.type || ''}</span>
      <Port e={e} f={f} side="L" connected={connected} pinSpan={pinSpan} />
      <Port e={e} f={f} side="R" connected={connected} pinSpan={pinSpan} />
    </div>
  );
}
```

Pin-bar height rule ports `sizePins` (`draw-all-edges.ts:33`): `2 * off + 11` px when the span is positive, no inline height otherwise.

- [ ] **Step 4: Run** folder + full suite → PASS.
- [ ] **Step 5: Commit** — `feat(eer): React scene — world, zone boxes, entity cards`

---

### Task 12: Scene components — EdgesSvg + Edge

**Files:**
- Create: `src/components/diagram/edges-svg/{edges-svg.tsx,edge.tsx,edges-svg.test.tsx,index.ts}` (index exports `EdgesSvg` only)

**Interfaces:**
- Consumes: `edgePath` (T5), `fieldEdges` (T7), `entityColor` (T1), `useFocusSets`/`useHiddenIds` (T11), context hooks (T10).
- Produces: `<EdgesSvg />` — the `.edges` svg with one `.edge` `<g>` per relationship.

- [ ] **Step 1: Write failing tests** (`edges-svg.test.tsx`):

```tsx
it('renders parity edge DOM with paths attached to ports', async () => {
  const { container } = await renderDiagram(<EdgesSvg />);
  const svg = container.querySelector('svg.edges') as SVGSVGElement;
  expect(svg.style.width).not.toBe('');
  const gs = svg.querySelectorAll('g.edge');
  expect(gs.length).toBe(3);
  const g = svg.querySelector('g.edge[data-rel="u-o"]') as SVGGElement;
  expect(g.dataset.kind).toBe('fk');
  expect(g.style.getPropertyValue('--edge-c')).toBeTruthy();
  for (const cls of ['edge-hit', 'edge-casing', 'edge-path', 'edge-head']) {
    expect(g.querySelector('path.' + cls.split(' ').join('.'))).toBeTruthy();
  }
  expect((g.querySelector('.edge-path') as SVGPathElement).getAttribute('d')).toMatch(/^M/);
});
it('dashed kinds get .dashed on the visible path', async () => {
  const raw = twoZoneRaw();
  raw.relationships[1]!.kind = 'nm'; // t-o becomes many-to-many (dashed style)
  const { container } = await renderDiagram(<EdgesSvg />, raw);
  expect(container.querySelector('g.edge[data-rel="t-o"] .edge-path')!.classList.contains('dashed')).toBe(true);
});
it('isolate: endpoints lit, others dim, svg lifts, raised edge renders last', async () => {
  const { container, actions } = await renderDiagram(<EdgesSvg />);
  await act(async () => actions.isolate('u-o'));
  const svg = container.querySelector('svg.edges')!;
  expect(svg.classList.contains('edge-top')).toBe(true);
  expect(svg.querySelector('g.edge[data-rel="u-o"]')!.classList.contains('active')).toBe(true);
  expect(svg.querySelector('g.edge[data-rel="t-o"]')!.classList.contains('dim')).toBe(true);
  const order = [...svg.querySelectorAll('g.edge')].map((g) => (g as SVGGElement).dataset.rel);
  expect(order[order.length - 1]).toBe('u-o');
});
it('edge hover marks hot and raises; click isolates', async () => {
  const { container, actions } = await renderDiagram(<EdgesSvg />);
  const g = container.querySelector('g.edge[data-rel="t-o"]') as SVGGElement;
  fireEvent.mouseEnter(g);
  expect(g.classList.contains('hot')).toBe(true);
  fireEvent.mouseLeave(g);
  expect(g.classList.contains('hot')).toBe(false);
  fireEvent.click(g);
  // focus visible through DOM: svg lifted + this edge active
  expect(container.querySelector('svg.edges')!.classList.contains('edge-top')).toBe(true);
  expect(g.classList.contains('active')).toBe(true);
  void actions;
});
it('field highlight heats attached edges; hidden kind hides the edge', async () => {
  const { container, actions } = await renderDiagram(<EdgesSvg />);
  await act(async () => actions.focusFromSearch('users', 'id'));
  expect(container.querySelector('g.edge[data-rel="u-o"]')!.classList.contains('hot')).toBe(true);
  await act(async () => actions.clearSelection());
  await act(async () => actions.toggleKind('fk'));
  expect(container.querySelector('g.edge[data-rel="u-o"]')!.classList.contains('hidden')).toBe(true);
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement.**

`edges-svg/edges-svg.tsx`:

```tsx
import { useMemo } from 'react';
import { fieldEdges } from '../../../engine/focus/field-edges';
import { useDiagramModel, useDiagramUi } from '../../../state/diagram-context';
import { useFocusSets, useHiddenIds } from '../entity-cards';
import { Edge } from './edge';

export function EdgesSvg() {
  const model = useDiagramModel();
  const ui = useDiagramUi();
  const focusSets = useFocusSets();
  const hidden = useHiddenIds();
  const fieldHot = useMemo(
    () => (ui.fieldHighlight ? fieldEdges(model, ui.fieldHighlight.entityId, ui.fieldHighlight.field) : null),
    [model, ui.fieldHighlight],
  );
  // The raised edge renders last — SVG paint order replaces the legacy appendChild raise.
  const rels = useMemo(() => {
    if (!ui.raisedEdge) return model.relationships;
    const raised = model.relById.get(ui.raisedEdge);
    return raised ? [...model.relationships.filter((r) => r.id !== ui.raisedEdge), raised] : model.relationships;
  }, [model, ui.raisedEdge]);
  return (
    <svg
      className={'edges' + (ui.focus?.type === 'edge' ? ' edge-top' : '')}
      style={{ width: model._content.w, height: model._content.h }}
    >
      {rels.map((rel) => (
        <Edge
          key={rel.id}
          rel={rel}
          active={focusSets?.edges.has(rel.id) ?? false}
          dim={!!focusSets && !focusSets.edges.has(rel.id)}
          forcedHot={(fieldHot?.has(rel.id) ?? false) || (ui.focus?.type === 'edge' && ui.focus.id === rel.id)}
          hidden={hidden.edges.has(rel.id)}
        />
      ))}
    </svg>
  );
}
```

`edges-svg/edge.tsx` (private):

```tsx
import { memo, useMemo, useState, type CSSProperties } from 'react';
import { edgePath } from '../../../engine/routing/edge-path';
import { entityColor } from '../../../engine/colors/entity-color';
import { useDiagramDispatch, useDiagramGeometry, useDiagramModel, useDiagramUi, useDiagramView } from '../../../state/diagram-context';
import type { Relationship } from '../../../engine/model/types';

interface EdgeProps { rel: Relationship; active: boolean; dim: boolean; forcedHot: boolean; hidden: boolean }

export const Edge = memo(function Edge({ rel, active, dim, forcedHot, hidden }: EdgeProps) {
  const model = useDiagramModel();
  const view = useDiagramView();
  const ui = useDiagramUi();
  const geometry = useDiagramGeometry();
  const dispatch = useDiagramDispatch();
  const [hover, setHover] = useState(false);

  // Live shape while this edge's endpoints are mid-gesture (legacy `fast` redraw):
  // entity drag → only that entity's edges; group drag → all edges; resize/idle → routed.
  const g = ui.gesture;
  const live =
    g.kind === 'group' || (g.kind === 'entity' && (rel.source === g.id || rel.target === g.id));
  const { d, head } = useMemo(
    () => edgePath(model, rel, view.routing, geometry, live),
    [model, rel, view.routing, geometry, live],
  );

  const dashed = model.kindStyle.get(rel.kind ?? '') === 'dashed';
  const cls = ['edge', (forcedHot || hover) && !dim && 'hot', active && 'active', dim && 'dim', hidden && 'hidden']
    .filter(Boolean).join(' ');
  return (
    <g
      className={cls}
      data-rel={rel.id}
      data-kind={rel.kind || ''}
      style={{ '--edge-c': entityColor(model, rel.target, ui.colors) } as CSSProperties}
      onMouseEnter={() => { if (!dim) { setHover(true); dispatch({ type: 'RAISE_EDGE', id: rel.id }); } }}
      onMouseLeave={() => setHover(false)}
      onClick={() => dispatch({ type: 'ISOLATE_EDGE', id: rel.id })}
    >
      <path className="edge-hit" d={d} />
      <path className="edge-casing" d={d} />
      <path className={'edge-path' + (dashed ? ' dashed' : '')} d={d} />
      <path className="edge-head" d={head} />
    </g>
  );
});
```

- [ ] **Step 4: Run** folder + full suite → PASS.
- [ ] **Step 5: Commit** — `feat(eer): React scene — edges svg with routed paths and paint-order raise`

---

### Task 13: use-diagram-gestures (pan/zoom/drag/resize/keyboard)

**Files:**
- Create: `src/hooks/use-diagram-gestures/{use-diagram-gestures.ts,gesture-math.ts,use-diagram-gestures.test.tsx,index.ts}` (index exports the hook only)

**Interfaces:**
- Consumes: context hooks (T10), `entityIdsInGroup`, `subgroupIdsOf`, actions/dispatch, `DiagramGesture` (T9).
- Produces: `useDiagramGestures(viewportRef: RefObject<HTMLDivElement | null>): void` — attaches wheel/mouse/key handlers; all state changes go through dispatch/actions. Constants preserved: `DRAG_THRESHOLD 3`, `RESIZE_EDGE 8`, `IN_PAD 8`, `IN_LABEL 30`, zoom clamp `[0.15, 3]`, wheel factor `Math.exp(-e.deltaY * 0.0015)`, min group size `140×80`.

`gesture-math.ts` (private, pure — port verbatim from `eer-diagram.ts`):

```ts
export interface EdgeMask { l: boolean; r: boolean; t: boolean; b: boolean }
export function edgeMaskFor(el: HTMLElement, e: MouseEvent): EdgeMask | null;   // eer-diagram.ts:41
export function cursorFor(m: EdgeMask): string;                                  // eer-diagram.ts:52
export function clamp(v: number, lo: number, hi: number): number;
export function contentBoundsOf(model: Model, gid: string): { minX: number; minY: number; maxX: number; maxY: number } | null; // eer-diagram.ts:335
export function clampCardToBox(x: number, y: number, e: Entity, b: GroupBounds): { x: number; y: number }; // the min-after-max clamp, eer-diagram.ts:457
export function resizeBox(s0: {x:number;y:number;w:number;h:number}, mask: EdgeMask, wdx: number, wdy: number,
  content: ReturnType<typeof contentBoundsOf>, parent: GroupBounds | null): { x: number; y: number; w: number; h: number }; // eer-diagram.ts:492-516
```

- [ ] **Step 1: Write failing tests.** Unit-test the pure math + an RTL harness for the interaction flows:

```tsx
// gesture-math tests: port resize clamp expectations from the old eer-diagram test
it('resizeBox never cuts children off and respects min size', () => {
  const content = { minX: 100, minY: 100, maxX: 300, maxY: 200 };
  const out = resizeBox({ x: 80, y: 60, w: 400, h: 300 }, { l: false, r: true, t: false, b: false }, -500, 0, content, null);
  expect(out.x + out.w).toBeGreaterThanOrEqual(300 + 8); // content.maxX + IN_PAD
  const min = resizeBox({ x: 0, y: 0, w: 150, h: 90 }, { l: false, r: true, t: false, b: true }, -200, -200, null, null);
  expect(min.w).toBe(140);
  expect(min.h).toBe(80);
});

// use-diagram-gestures.test.tsx — harness renders the full scene inside a viewport div
function Scene() {
  const viewportRef = useViewportRef();
  useDiagramGestures(viewportRef);
  return (
    <div ref={viewportRef} className="viewport">
      <World><ZoneBoxes /><EdgesSvg /><EntityCards /></World>
    </div>
  );
}

it('click on a card selects; drag past threshold moves it', async () => {
  const { container, actions } = await renderDiagram(<Scene />);
  const card = container.querySelector('.card[data-entity="users"]') as HTMLElement;
  fireEvent.mouseDown(card, { button: 0, clientX: 10, clientY: 10 });
  fireEvent.mouseUp(window);
  expect(container.querySelector('.card[data-entity="users"]')!.classList.contains('selected')).toBe(true);
  await act(async () => actions.clearSelection());
  const before = (container.querySelector('.card[data-entity="users"]') as HTMLElement).style.transform;
  fireEvent.mouseDown(container.querySelector('.card[data-entity="users"]')!, { button: 0, clientX: 10, clientY: 10 });
  fireEvent.mouseMove(window, { clientX: 60, clientY: 40 });
  fireEvent.mouseUp(window);
  const after = (container.querySelector('.card[data-entity="users"]') as HTMLElement).style.transform;
  expect(after).not.toBe(before);
  expect(container.querySelector('.card[data-entity="users"]')!.classList.contains('selected')).toBe(false);
});
it('empty-space click clears selection; drag pans', async () => {
  const { container, actions } = await renderDiagram(<Scene />);
  await act(async () => actions.selectEntity('users'));
  const vp = container.querySelector('.viewport') as HTMLElement;
  fireEvent.mouseDown(vp, { button: 0, clientX: 5, clientY: 5 });
  fireEvent.mouseUp(window);
  expect(container.querySelector('.card.selected')).toBeNull();
  const world = container.querySelector('.world') as HTMLElement;
  const t0 = world.style.transform;
  fireEvent.mouseDown(vp, { button: 0, clientX: 5, clientY: 5 });
  fireEvent.mouseMove(window, { clientX: 105, clientY: 55 });
  fireEvent.mouseUp(window);
  expect(world.style.transform).not.toBe(t0);
});
it('zone click focuses the group; zone drag moves box + members together', async () => {
  const { container } = await renderDiagram(<Scene />);
  const zone = container.querySelector('.zone[data-group="z2"]') as HTMLElement;
  fireEvent.mouseDown(zone, { button: 0, clientX: 400, clientY: 300 });
  fireEvent.mouseUp(window);
  expect(zone.classList.contains('zone-selected')).toBe(true);
  // jsdom rects are 0 → edgeMaskFor returns a mask at 0,0; drag from a point far from edges is
  // impossible to synthesize, so group-move is covered by dispatching SET_POSITIONS directly in
  // the reducer test — here we assert the click/select path only.
});
it('wheel zooms toward the cursor within [0.15, 3]', async () => {
  const { container } = await renderDiagram(<Scene />);
  const vp = container.querySelector('.viewport') as HTMLElement;
  const world = container.querySelector('.world') as HTMLElement;
  fireEvent.wheel(vp, { deltaY: -500, clientX: 100, clientY: 100 });
  expect(world.style.transform).toMatch(/scale\((?!1\))/); // zoomed away from 1
});
it('Escape clears the selection', async () => {
  const { container, actions } = await renderDiagram(<Scene />);
  await act(async () => actions.selectEntity('users'));
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(container.querySelector('.card.selected')).toBeNull();
});
```

**jsdom honesty note:** `getBoundingClientRect` returns zeros, so resize-edge grabbing (`edgeMaskFor`) can misfire in jsdom — a zone mousedown at any coordinate may classify as `resize`. To keep the select test meaningful, have `edgeMaskFor` return `null` when the rect has zero width AND height (a real browser never produces that for a rendered zone). Document this guard with a comment: `// jsdom rects are 0×0 — treat as "not near an edge" so tests exercise the group path`.

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement.** Port `wireGlobal` + `wireScene`'s mousedown/move/up machinery from `eer-diagram.ts:289-571` into the hook, with these translations (everything else — thresholds, clamps, mode branching — verbatim):

| Legacy | Hook |
|---|---|
| `state.view.panX/panY/zoom = …; applyTransform(state)` | `dispatch({ type: 'SET_VIEW', view: { zoom, panX, panY } })` |
| `en.x = …; positionEntity(); drawEdgesForEntity(id, true)` | `dispatch({ type: 'SET_POSITIONS', entities: [{ id, x, y }], boxes: [] })` (clamped via `clampCardToBox`) |
| group move: entity + box style writes | one `SET_POSITIONS` with all member entities + carried boxes per mousemove |
| resize: `obj/el` writes | `dispatch({ type: 'RESIZE_GROUP', id, ...resizeBox(...) })` |
| `mode = 'drag'` bookkeeping | `dispatch({ type: 'SET_GESTURE', gesture: { kind: 'entity', id } })` on threshold crossing; `{ kind: 'group' }` / `{ kind: 'resize' }` likewise; `{ kind: 'idle' }` on mouseup |
| `this.selectEntity(id)` / `selectGroup` / `clearSelection` on click | `actions.selectEntity(id)` / `actions.selectGroup(id)` / `actions.clearSelection()` |
| hover resize cursor (`zone.style.cursor`) | keep as direct style write on the zone element (transient UI, not state) |
| `onUp` non-curved full redraw | nothing — `SET_GESTURE idle` unfreezes the geometry memo, which recomputes routes |

Hook skeleton (transient gesture bookkeeping lives in refs — it is per-gesture scratch, not render state):

```ts
export function useDiagramGestures(viewportRef: RefObject<HTMLDivElement | null>): void {
  const model = useDiagramModelOrNull();
  const view = useDiagramView();
  const dispatch = useDiagramDispatch();
  const actions = useDiagramActions();
  const modelRef = useRef(model); modelRef.current = model;
  const viewRef = useRef(view); viewRef.current = view;

  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    // …port of onWheel/onDown/onMove/onUp/onKey reading modelRef/viewRef,
    // dispatching as per the table above…
    vp.addEventListener('wheel', onWheel, { passive: false });
    vp.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('keydown', onKey);
    return () => { /* remove all five */ };
  }, [viewportRef, dispatch, actions]);
}
```

Wheel must stay a manual `addEventListener(…, { passive: false })` — React's synthetic wheel can't `preventDefault`. Event delegation stays: `target.closest('.card')` / `.closest('.zone')` / `.closest('.port')` reads `dataset.entity`/`dataset.group` exactly like the legacy handler, so no per-card listeners are added.

- [ ] **Step 4: Run** folder + full suite → PASS.
- [ ] **Step 5: Commit** — `feat(eer): gesture hook — pan/zoom/drag/resize/keyboard as dispatches`

---

### Task 14: run-checks re-signature

**Files:**
- Modify: `src/engine/checks/run-checks/run-checks.ts`, its test, `index.ts`

**Interfaces:**
- Consumes: `edgeEndpoints(model, rel, slot)` (T3), `EdgeGeometry` (T5), `cssEsc` (T1 location `engine/dom/css-esc`), `portWorldPos`, `loadModel`.
- Produces:

```ts
export interface RunChecksArgs {
  model: Model;
  geometry: EdgeGeometry;
  view: { zoom: number; panX: number; panY: number };
  root: HTMLElement;          // the .viewport element — cards/edges are queried under it
}
export function runChecks(args: RunChecksArgs): CheckResult[];
```

Check-by-check translation (same four names, same pass criteria):
1. **Endpoints** — `edgeEndpoints(model, rel, geometry.slots.get(rel.id))`; port/path elements via `root.querySelector('.port[data-entity=…]')` / `root.querySelector('.edge[data-rel=…] .edge-path')` instead of the `els` maps; `domPortBar` uses `root.getBoundingClientRect()` + `view` for the screen→world conversion (unchanged math).
2. **Port pairs** — query `.card[data-entity=…]` under `root` instead of `els.cards`.
3. **No reflow** — the legacy version dispatched real focus calls; state-driven focus can't be toggled synchronously from a pure function. Replace with the class-injection equivalent (the invariant is "highlight classes never change geometry"): snapshot `portWorldPos` for every entity AND the DOM rect of one sample port; add `focus`+`selected` to the first card element and `hot` to its first edge directly via `classList`; re-read positions + the sample rect; assert unchanged; remove the injected classes. Same result name `'Hover/focus never moves a node'`.
4. **Broken refs** — unchanged (pure `loadModel` probe).

- [ ] **Step 1: Rewrite the test file.** Build the scene with the React helper instead of `makeScene`:

```tsx
// run-checks.test.ts becomes run-checks.test.tsx (it renders JSX now).
import { buildModel } from '../../../test/models';
import { renderDiagram } from '../../../test/render';
import { computeEdgeGeometry } from '../../routing/edge-geometry';
import { EdgesSvg } from '../../../components/diagram/edges-svg';
import { EntityCards } from '../../../components/diagram/entity-cards';
import { World } from '../../../components/diagram/world';
import { ZoneBoxes } from '../../../components/diagram/zone-boxes';
import { runChecks } from './run-checks';

// <Diagram> arrives in T15 — compose the scene inline here.
async function checkedScene() {
  const { container } = await renderDiagram(
    <div className="viewport"><World><ZoneBoxes /><EdgesSvg /><EntityCards /></World></div>,
  );
  const model = buildModel(); // same fixture the helper loaded — packLayout is deterministic
  const root = container.querySelector('.viewport') as HTMLElement;
  return { model, root, container };
}

it('all four checks pass on a healthy scene (modulo jsdom zero-rects)', async () => {
  const { model, root } = await checkedScene();
  const results = runChecks({ model, geometry: computeEdgeGeometry(model, 'avoid'), view: { zoom: 1, panX: 0, panY: 0 }, root });
  expect(results).toHaveLength(4);
  // jsdom zero-rects make the DOM-bar comparison unreliable (old suite had the same caveat),
  // so exempt only the endpoint check's DOM half from the pass assertion:
  expect(results.filter((r) => r.name !== 'Every edge endpoint lands on a real port').every((r) => r.pass)).toBe(true);
});

it('failure injection: a missing port and a corrupted path are reported', async () => {
  const { model, root } = await checkedScene();
  root.querySelector('.port.left[data-entity="users"][data-field="name"]')!.remove();
  root.querySelector('.edge[data-rel="u-o"] .edge-path')!.setAttribute('d', 'M 0 0 L 1 1');
  const results = runChecks({ model, geometry: computeEdgeGeometry(model, 'avoid'), view: { zoom: 1, panX: 0, panY: 0 }, root });
  expect(results.find((r) => r.name === 'Exactly one L + one R port per field')!.problems.join()).toContain('users.name');
  expect(results.find((r) => r.name === 'Every edge endpoint lands on a real port')!.problems.join()).toContain('u-o: path start off source port');
});
```

Note the reducer's `LOAD` re-packs, and the geometry recomputed here must describe the DOM the helper rendered — `packLayout` and `computeEdgeGeometry` are deterministic (T5/T6 tests pin this), so building the same fixture twice yields identical coordinates. The corrupted-`d` assertion only holds under `routing: 'avoid'` when the rendered scene also used `avoid` (the fixture's `view.routing`), which it does.

Port the two failure-injection tests from the existing run-checks test verbatim (they operate on the DOM, which still exists — only the handles changed).

- [ ] **Step 2: Run** → FAIL (signature mismatch).
- [ ] **Step 3: Implement** per the translation table. Keep `EPS 0.5` / `DOM_EPS 1.5`.
- [ ] **Step 4: Run** folder + full suite → PASS. (Legacy `EerDiagram.runChecks` still compiles because the legacy engine keeps its own old call? No — the signature changed. Update `eer-diagram.ts:241` to construct the args: `runChecks({ model: this.state.model, geometry: computeEdgeGeometry(this.state.model, this.state.view.routing), view: this.state.view, root: this.state.els.viewport })`. The `_route`-based scene and the pure geometry agree because both come from the same inputs.)
- [ ] **Step 5: Commit** — `refactor(eer): runChecks takes model+geometry+root instead of EngineState`

---

### Task 15: The switch — use-model-loader, Diagram composition, EerViewer/TopBar/SearchBox/DetailPanel rewire

**Files:**
- Create: `src/hooks/use-model-loader/{use-model-loader.ts,use-model-loader.test.tsx,index.ts}`
- Create: `src/components/diagram/diagram/{diagram.tsx,diagram.test.tsx,index.ts}`
- Modify: `src/components/eer-viewer/eer-viewer.tsx` + test
- Modify: `src/components/top-bar/top-bar.tsx`, `src/components/top-bar/search-box.tsx` + test
- Modify: `src/components/detail-panel/detail-panel.tsx`, `entity-detail.tsx`, `group-detail.tsx`, `edge-detail.tsx`, `colors-form.tsx` (wherever `engine`/props flow) + test
- Modify: `src/state/diagram-provider/diagram-provider.tsx` (real `runChecks` body)

**Interfaces:**
- Consumes: everything above.
- Produces:

```ts
// use-model-loader
export interface Diagnostics { errors: string[]; warnings: string[] }
export function useModelLoader(): { diagnostics: Diagnostics; dismiss: () => void };
// Diagram
export function Diagram({ children }: { children?: ReactNode }): JSX.Element; // .viewport div + World(ZoneBoxes,EdgesSvg,EntityCards) + children overlays
```

- [ ] **Step 1: use-model-loader** (test first: default JSON load populates model + surfaces warnings; bad `?model=` URL yields a fetch error diagnostic — mock `fetch`):

```ts
// Fetch ?model= (or the bundled default), validate, LOAD, and re-pack once
// webfonts are ready so measured card widths are correct (legacy load()).

import { useEffect, useRef, useState } from 'react';
import { loadModel } from '../../engine/model/load-model';
import { useDiagramActions } from '../../state/diagram-context';
import defaultModelJson from '../../model/eer-model.json';

export interface Diagnostics { errors: string[]; warnings: string[] }

export function useModelLoader(): { diagnostics: Diagnostics; dismiss: () => void } {
  const actions = useDiagramActions();
  const [diagnostics, setDiagnostics] = useState<Diagnostics>({ errors: [], warnings: [] });
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // StrictMode double-invoke guard
    ran.current = true;
    let cancelled = false;

    const apply = (raw: unknown) => {
      if (cancelled) return;
      const result = loadModel(raw);
      setDiagnostics({ errors: result.errors, warnings: result.warnings });
      if (!result.errors.length && result.model) {
        actions.load(result.model);
        const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
        if (fonts?.ready) void fonts.ready.then(() => { if (!cancelled) actions.repackAndFit(); });
      }
    };

    const modelUrl = new URL(window.location.href).searchParams.get('model');
    if (modelUrl) {
      fetch(modelUrl, { cache: 'no-store' })
        .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
        .then(apply)
        .catch((err: unknown) => {
          if (!cancelled) setDiagnostics({ errors: [`Could not load ${modelUrl}: ${err instanceof Error ? err.message : String(err)}`], warnings: [] });
        });
    } else {
      apply(defaultModelJson);
    }
    return () => { cancelled = true; };
  }, [actions]);

  return { diagnostics, dismiss: () => setDiagnostics({ errors: [], warnings: [] }) };
}
```

- [ ] **Step 2: Diagram composition** (test: full scene renders 3 cards/3 edges/2 zones from the fixture; overlay children appear inside the viewport):

```tsx
import type { ReactNode } from 'react';
import { useDiagramGestures } from '../../../hooks/use-diagram-gestures';
import { useDiagramModelOrNull, useViewportRef } from '../../../state/diagram-context';
import { EdgesSvg } from '../edges-svg';
import { EntityCards } from '../entity-cards';
import { World } from '../world';
import { ZoneBoxes } from '../zone-boxes';

export function Diagram({ children }: { children?: ReactNode }) {
  const viewportRef = useViewportRef();
  const model = useDiagramModelOrNull();
  useDiagramGestures(viewportRef);
  return (
    <div ref={viewportRef} className="viewport">
      {model && (
        <World>
          <ZoneBoxes />
          <EdgesSvg />
          <EntityCards />
        </World>
      )}
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Real runChecks in the provider** — replace the T10 stub:

```ts
runChecks: (): CheckResult[] => {
  const s = stateRef.current;
  const vp = viewportRef.current;
  if (!s.model || !vp) return [];
  return runChecks({ model: s.model, geometry: geometryRef.current, view: s.view, root: vp });
},
```

- [ ] **Step 4: Rewire the chrome components** (update their existing tests to render inside `renderDiagram` instead of passing an `engine` prop):
  - `eer-viewer.tsx` — becomes composition only:

```tsx
import { useState } from 'react';
import type { CheckResult } from '../../engine/model/types';
import { DiagramProvider, useDiagramActions } from '../../state/diagram-provider';
import { useModelLoader } from '../../hooks/use-model-loader';
import { Diagram } from '../diagram/diagram';
import { ChecksOverlay } from '../checks-overlay';
import { DetailPanel } from '../detail-panel';
import { ErrorBanner } from '../error-banner';
import { TopBar } from '../top-bar';

function Viewer() {
  const { diagnostics, dismiss } = useModelLoader();
  const actions = useDiagramActions();
  const [checks, setChecks] = useState<CheckResult[] | null>(null);
  return (
    <div className="grid h-screen grid-rows-[auto_1fr]">
      <TopBar onSelfCheck={() => setChecks(actions.runChecks())} />
      <div className="grid min-h-0 grid-cols-[1fr_auto]">
        <Diagram>
          <ErrorBanner errors={diagnostics.errors} warnings={diagnostics.warnings} onDismiss={dismiss} />
          {checks && <ChecksOverlay results={checks} onClose={() => setChecks(null)} />}
        </Diagram>
        <DetailPanel />
      </div>
    </div>
  );
}

export function EerViewer() {
  return (
    <DiagramProvider>
      <Viewer />
    </DiagramProvider>
  );
}
```

  - `top-bar.tsx` — drop `engine`, `model`, `routing`, `hiddenGroups`, `hiddenKinds`, `colors`, `onCycleRouting`, `onToggleGroup`, `onToggleKind`, `onFit`, `onRearrange` props; keep only `onSelfCheck: () => void`. Read `const model = useDiagramModelOrNull(); const view = useDiagramView(); const ui = useDiagramUi(); const actions = useDiagramActions();`. Cycle routing locally: `const order: RoutingMode[] = ['curved', 'avoid', 'ortho']; actions.setRouting(order[(order.indexOf(view.routing) + 1) % order.length]!)`. Chips call `actions.toggleGroup(g.id)` / `actions.toggleKind(k.id)` with `on={!ui.hidden.groups.has(g.id)}`; Fit/Rearrange call `actions.fit()` / `actions.rearrange()`.
  - `search-box.tsx` — drop the `engine` prop: `const actions = useDiagramActions();` then `actions.search(q)` and `actions.focusFromSearch(m.entityId, m.field)`.
  - `detail-panel.tsx` — drop `engine`, `model`, `selection`, `colors`, `onColorsChange` props; read `const model = useDiagramModelOrNull(); const ui = useDiagramUi(); const actions = useDiagramActions();` and dispatch on `ui.panelSelection`. Child views (`entity-detail`, `group-detail`, `edge-detail`) swap `engine?.selectEntity/selectGroup/centerOn/isolateSilent` for the identical `actions.*` calls; `colors-form` uses `ui.colors` + `actions.setColors`.
  - Delete `window.__eer = engine` from the old effect (the provider now owns the dev handle).

- [ ] **Step 5: Update `src/main.tsx`/`src/app.tsx`** — no changes needed (they render `<App/>` → `<EerViewer/>`); verify only.

- [ ] **Step 6: Run** full suite (`pnpm exec vitest run`) + `pnpm typecheck` → PASS. Start the dev server (`pnpm --filter @tickets/eer dev` or the running mprocs) and load http://localhost:4630 — expect 22 cards, 37 edges, zones, working pan/zoom/drag/search/panel.
- [ ] **Step 7: Commit** — `feat(eer): React scene goes live — provider-driven viewer, engine class unused`

---

### Task 16: Delete legacy engine UI code + type cleanup

**Files:**
- Delete: `src/engine/diagram/` (whole category), `src/engine/render/{build-scene,position-entity,apply-transform,draw-edge,draw-all-edges,draw-edges-for-entity,set-colors,set-routing,relayout,mark-connected-ports}/`, `src/engine/focus/{apply-dim,apply-visibility,clear-field-highlight,clear-focus,focus-entity,focus-group,highlight-field,isolate-edge,raise-edge}/`, `src/test/scene.ts`
- Modify: `src/engine/geometry/compute-pin-slots/` (remove the legacy `computePinSlots` wrapper + its wrapper assertions), `src/engine/routing/compute-routes/` (remove the `computeRoutes` wrapper likewise), `src/engine/geometry/edge-endpoints/edge-endpoints.ts` (drop the `rel._srcSlot` fallback — the param stays optional `slot?: EdgeSlots` because `geometry.slots.get(rel.id)` legitimately yields `undefined`, but the body becomes `p1.y += slot?.src ?? 0; p2.y += slot?.tgt ?? 0;`), `src/engine/model/types/types.ts`

**Steps:**

- [ ] **Step 1: Delete the folders** listed above with `git rm -r`. The `render/` directory should now be empty — remove it; `focus/` keeps only the six selector folders from T7.

- [ ] **Step 2: Type cleanup** in `types.ts`:
  - Remove `Relationship._route`, `_srcSlot`, `_tgtSlot` and `Model._pinSpan`.
  - Remove `EngineEls`, `EdgeEls`, `EngineState`.
  - Keep `Focus`, `Selection`, `CheckResult`, `SearchResult`, `LoadResult` — the React layer uses them.

- [ ] **Step 3: Remove the legacy wrappers** (`computePinSlots`, `computeRoutes`) and make `edgeEndpoints`'s third parameter required. Fix the compile fallout — `grep -rn "computePinSlots\|computeRoutes(" src` must return only `pinSlots`/`routeEdges`/`computeEdgeGeometry` internals; every `edgeEndpoints(` call passes a slot (run-checks and edge-path already do).

- [ ] **Step 4: Sweep** — `grep -rn "EngineState\|EerDiagram\|buildScene\|drawAllEdges\|applyTransform\|makeScene\|test/scene" src` → zero hits. `pnpm exec vitest run` → all pass; `pnpm typecheck` clean; `pnpm build` clean.

- [ ] **Step 5: Commit** — `refactor(eer): delete the imperative engine — React owns the scene`

```
The EerDiagram class, DOM builders, classList focus code and the mutation
wrappers are gone; engine/ is pure calculation, the provider + components
are the only DOM owners.
```

---

### Task 17: Live verification on :4630

- [ ] **Step 1:** Ensure the dev stack is running (see `running-the-stack` skill; eer dev server is :4630 under mprocs). Touch nothing else.
- [ ] **Step 2:** Load http://localhost:4630 in the browser (Chrome MCP: `list_pages`/`new_page`, `select_page` takes `pageId`). If vite serves stale module URLs after the deletions, `touch src/app.tsx src/main.tsx` and reload with ignoreCache.
- [ ] **Step 3:** Verify against the legacy behavior checklist:
  - 22 cards / 37 edges / zone boxes render; console clean.
  - `window.__eer.actions.runChecks()` → 4/4 pass.
  - Wheel zoom-to-cursor; middle-drag and empty-space-drag pan; card drag (stays inside its zone box, edges follow live, routes settle on release); zone drag carries members + subgroup boxes; subgroup drag confined to parent; zone edge-grab resize with cursor affordance and child clamping.
  - Click card → panel entity view + neighbours lit; click zone → group view + `zone-selected`; click edge → isolate with lifted svg; panel rel-rows isolate silently (panel keeps its view, canvas isolates); Escape/empty-click clears.
  - Search: type, pick a field result → centers, highlights field edges.
  - Routing cycle curved→avoid→ortho redraws; Fit/Rearrange work; zone/kind chips hide; colours form recolours zone/card/edge without anything moving.
- [ ] **Step 4:** Fix anything broken (systematic-debugging skill), re-run suite, commit fixes as `fix(eer): …`.
- [ ] **Step 5:** Report completion; offer the finishing-a-development-branch flow.

---

## Deliberate behavior differences (accepted, documented)

1. **Pin-fan refresh after curved-mode drags:** legacy skipped recomputing pin fans on mouseup in curved mode (stale fan order until the next full redraw); the React geometry memo always recomputes on gesture end. Strictly fresher — accepted.
2. **Zone box ↔ bounds sync:** legacy `relayout` matched zone DOM to `_groupBounds` by array index (documented quirk); React keys `ZoneBox` by group id, eliminating the quirk.
3. **`raiseEdge` on hover** now leaves paint order to render order (raised edge rendered last) instead of DOM `appendChild`; identical visual result.

## Self-review checklist (for the plan executor)

- Spec coverage: DOM parity (T11/T12 tests), provider+reducer (T9/T10), gestures (T13), pure engine (T1–T8), run-checks (T14), loader/banner (T15), deletion (T16), live verify (T17). Search cap, isolateSilent, fonts re-pack, double-rAF fit, zoom clamps all pinned in tests.
- Every new exported symbol is defined in exactly one task's Produces block; later tasks import those names verbatim.
- No task leaves the suite red: legacy wrappers keep old callers alive until T16.
