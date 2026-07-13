# EER Model Editor + Edge-Overlap Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix overlapping parallel edges, then turn the EER viewer into a model editor: file-backed models behind a Vite dev API, CRUD for groups/subgroups/tables via modals, auto connections from FK fields, persisted layout + colours.

**Architecture:** Workstream B first (routing bug, test-first, no UI). Workstream A: raw JSON schema gains optional layout/colours; a pure `apply-model-edit` engine module powers one new reducer action; a Vite middleware plugin serves `apps/eer/models/*.json`; TopBar gains model dropdown/new/save; one modal primitive hosts group/table/model forms. Spec of record: `docs/superpowers/specs/2026-07-13-eer-model-editor-design.md`.

**Tech Stack:** React 19 + reducer/context state (`state/diagram-*`), pure engine modules one-per-folder with vitest, Tailwind v4 (strict boundary), Vite 8 dev middleware, node:fs for storage.

## Global Constraints

- `pnpm --filter @tickets/eer test` and `pnpm --filter @tickets/eer typecheck` must pass after every task; typecheck also runs `scripts/verify-tailwind.mjs`.
- Tailwind boundary (enforced): no arbitrary values (`h-[34px]`), no class string > 100 chars (split into grouped `cn()` args), no fractional spacing steps (`py-1.5` exists as a token? — only integer steps; `1.5` IS an integer step in Tailwind's scale and is used in the codebase — the guard rejects `-\d+\.\d+` patterns like `8.5`), style props may set only `--*` variables via `runtimeStyle`, no DOM `.style` API.
- Engine modules: one function per folder (`<name>/<name>.ts` + `index.ts` + `<name>.test.ts`), pure, no DOM writes.
- Conventional commits scoped `(eer)`, one commit per task.
- All test fixtures come from `src/test/models.ts` (`buildModel`, `pkField`, `fkTo`) unless a task defines its own raw object.
- Working tree contains unrelated in-flight changes — `git add` only the files each task names; never `git add -A`.

---

## Workstream B — edge overlap fix

### Task B1: Overlap-invariant repro test (red)

**Files:**
- Modify: `apps/eer/src/engine/routing/compute-routes/compute-routes.test.ts`

**Interfaces:**
- Produces: test helper `overlappingPairs(routes: Map<string, Point[] | null>): string[]` used again in B2's verification; the failing test `'a hub fanned to three stacked targets gets a distinct lane per edge'`.

- [ ] **Step 1: Write the overlap detector + hub repro test (failing)**

Append to `compute-routes.test.ts`:

```ts
// Two segments "overlap" when they are collinear (same axis + same cross-coord
// within the casing width) and their spans intersect for more than a point.
// The pin fan at a shared port separates slots by < casing, so endpoints that
// touch at a port are excluded by the 6px span-trim.
function overlappingPairs(routes: Map<string, Point[] | null>): string[] {
  interface Run { rel: string; axis: 'h' | 'v'; cross: number; lo: number; hi: number }
  const runs: Run[] = [];
  for (const [rel, pts] of routes) {
    if (!pts) continue;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]!;
      const b = pts[i]!;
      if (Math.abs(a.y - b.y) < 0.01 && Math.abs(a.x - b.x) > 12) {
        runs.push({ rel, axis: 'h', cross: a.y, lo: Math.min(a.x, b.x) + 6, hi: Math.max(a.x, b.x) - 6 });
      } else if (Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) > 12) {
        runs.push({ rel, axis: 'v', cross: a.x, lo: Math.min(a.y, b.y) + 6, hi: Math.max(a.y, b.y) - 6 });
      }
    }
  }
  const bad: string[] = [];
  for (let i = 0; i < runs.length; i++) {
    for (let j = i + 1; j < runs.length; j++) {
      const p = runs[i]!;
      const q = runs[j]!;
      if (p.rel === q.rel || p.axis !== q.axis) continue;
      if (Math.abs(p.cross - q.cross) >= 4.5) continue; // casing width — visually merged below this
      if (p.lo < q.hi && q.lo < p.hi) bad.push(`${p.rel} ∥ ${q.rel} @ ${p.axis}=${Math.round(p.cross)}`);
    }
  }
  return bad;
}

it('a hub fanned to three stacked targets gets a distinct lane per edge', () => {
  const raw = {
    groups: [{ id: 'z', label: 'Z', order: 0 }],
    entities: [
      { id: 'hub', group: 'z', fields: [pkField] },
      { id: 'ta', group: 'z', fields: [pkField, fkTo('hub')] },
      { id: 'tb', group: 'z', fields: [pkField, fkTo('hub')] },
      { id: 'tc', group: 'z', fields: [pkField, fkTo('hub')] },
    ],
    relationships: [
      { id: 'h-a', source: 'hub', sourceField: 'id', target: 'ta', targetField: 'hub_id' },
      { id: 'h-b', source: 'hub', sourceField: 'id', target: 'tb', targetField: 'hub_id' },
      { id: 'h-c', source: 'hub', sourceField: 'id', target: 'tc', targetField: 'hub_id' },
    ],
  };
  const model = buildModel(raw);
  // Hub on the left, three targets stacked far right — all three edges leave one
  // port and travel the same corridor.
  Object.assign(model.entityById.get('hub')!, { x: 0, y: 300, _w: 140, _h: 60 });
  Object.assign(model.entityById.get('ta')!, { x: 500, y: 0, _w: 140, _h: 80 });
  Object.assign(model.entityById.get('tb')!, { x: 500, y: 300, _w: 140, _h: 80 });
  Object.assign(model.entityById.get('tc')!, { x: 500, y: 600, _w: 140, _h: 80 });
  const { slots } = pinSlots(model);
  const { routes } = routeEdges(model, slots);
  expect(overlappingPairs(routes)).toEqual([]);
});
```

- [ ] **Step 2: Run it — confirm red and RECORD the evidence**

Run: `pnpm --filter @tickets/eer vitest run src/engine/routing/compute-routes`
Expected: the new test FAILS listing at least one overlapping pair. Paste the failing pairs and the three routes (`console.log([...routes])` temporarily if needed) into the task notes — B2's fix must explain them. If the test unexpectedly PASSES, vary the target stack (e.g. all three `x: 500, y: 0/80/160` so target ports bunch) until it reproduces the on-screen overlap; if it still passes, STOP — re-diagnose with the systematic-debugging skill against the live model before writing any fix.

- [ ] **Step 3: Commit the red test**

```bash
git add apps/eer/src/engine/routing/compute-routes/compute-routes.test.ts
git commit -m "test(eer): failing repro — fanned edges share a lane and overlap"
```

### Task B2: Lane-allocation fix (green)

**Files:**
- Modify: `apps/eer/src/engine/routing/compute-routes/compute-routes.ts` (the `separateAxis` candidate loop, currently ~lines 118-133)

**Interfaces:**
- Consumes: B1's failing test + recorded evidence.
- Produces: green overlap-invariant test; no change to any exported signature.

- [ ] **Step 1: Apply the lane-search escalation fix**

In `separateAxis`, the current allocation gives up into overlap (`if (coord == null) coord = s.key;`). Replace the loop + fallback:

```ts
  // Longest runs place first: big trunks keep their A* lane, short runs adjust.
  const movable = segs.filter((s) => !s.fixed).sort((a, b) => b.hi - b.lo - (a.hi - a.lo));
  for (const s of movable) {
    const near = placed.filter((p) => p.lo <= s.hi + 1 && p.hi >= s.lo - 1);
    let coord: number | null = null;
    let fallback: number | null = null; // separated but card-blocked — still beats overlap
    outer: for (let j = 0; j <= 24; j++) {
      for (const c of j === 0 ? [s.key] : [s.key + j * LANE_STEP, s.key - j * LANE_STEP]) {
        if (near.some((p) => Math.abs(p.coord - c) < MIN_SEP)) continue;
        if (vertical && shrinksPortStub(s, c)) continue;
        if (j > 0 && shiftBlocked(model, cards, s, c - s.key, vertical)) {
          fallback ??= c;
          continue;
        }
        coord = c;
        break outer;
      }
    }
    // Never stack two runs on one lane: a separated-but-blocked lane reads far
    // better than two lines drawn on top of each other.
    if (coord == null) coord = fallback ?? s.key;
    applyShift(s, coord - s.key, vertical);
    placed.push({ lo: s.lo, hi: s.hi, coord });
    entries.push({ s, coord });
  }
```

The two changes: search depth 12 → 24, and a `fallback` that prefers a separated lane over stacking, keeping stay-put only as the true last resort. **If B1's recorded evidence points somewhere else** (e.g. the overlap is between two `fixed` port stubs of the same port, which no lane pass may move), do NOT force this patch — return to the evidence: fixed-stub overlaps are a `compute-pin-slots` fan-spacing issue and the fix belongs there (slot spacing ≥ `MIN_SEP` for same-port bundles). Implement where the evidence says, keeping this task's test as the acceptance gate.

- [ ] **Step 2: Run the routing tests**

Run: `pnpm --filter @tickets/eer vitest run src/engine/routing`
Expected: PASS including B1's test (all prior stub/route tests too).

- [ ] **Step 3: Full suite + typecheck**

Run: `pnpm --filter @tickets/eer test && pnpm --filter @tickets/eer typecheck`
Expected: PASS.

- [ ] **Step 4: Live check**

With `pnpm dev` running, open `http://localhost:4630`, isolate the `users` card (it fans to several tables). Confirm parallel runs sit on distinct lanes (≥ 4.5px apart). Screenshot for the record.

- [ ] **Step 5: Commit**

```bash
git add apps/eer/src/engine/routing/compute-routes/compute-routes.ts
git commit -m "fix(eer): fanned parallel edges escalate lane search instead of stacking"
```

---

## Workstream A — model editor

### Task A1: Raw schema — positions, bounds, colours in `loadModel`; layout honors them

**Files:**
- Modify: `apps/eer/src/engine/model/types/types.ts` (Model + Entity + GroupBounds untouched; Model gains `colors` and `_savedLayout`)
- Modify: `apps/eer/src/engine/model/load-model/load-model.ts`
- Modify: `apps/eer/src/engine/layout/pack-layout/pack-layout.ts`
- Test: `apps/eer/src/engine/model/load-model/load-model.test.ts`, `apps/eer/src/engine/layout/pack-layout/pack-layout.test.ts`

**Interfaces:**
- Produces: `Model.colors: ReadonlyMap<string, string>` (empty map when absent); `Model._savedLayout?: SavedLayout` where `interface SavedLayout { entities: Map<string, { x: number; y: number }>; groups: Map<string, { x: number; y: number; w: number; h: number }> }` (exported from `types.ts`); `packLayout` re-applies `_savedLayout` after packing.

- [ ] **Step 1: Failing tests**

`load-model.test.ts` — append:

```ts
it('reads optional colors, entity x/y and group bounds into the model', () => {
  const raw = {
    colors: { z1: '#112233', users: '#445566' },
    groups: [{ id: 'z1', label: 'Z', order: 0, bounds: { x: 5, y: 6, w: 700, h: 500 } }],
    entities: [{ id: 'users', group: 'z1', x: 40, y: 50, fields: [{ name: 'id', type: 'int', role: 'pk' }] }],
  };
  const { model, errors } = loadModel(raw);
  expect(errors).toEqual([]);
  expect(model!.colors.get('z1')).toBe('#112233');
  expect(model!._savedLayout!.entities.get('users')).toEqual({ x: 40, y: 50 });
  expect(model!._savedLayout!.groups.get('z1')).toEqual({ x: 5, y: 6, w: 700, h: 500 });
});

it('defaults colors to an empty map and savedLayout to undefined', () => {
  const { model } = loadModel({ groups: [{ id: 'z', label: 'Z' }], entities: [{ id: 'e', group: 'z', fields: [{ name: 'id' }] }] });
  expect(model!.colors.size).toBe(0);
  expect(model!._savedLayout).toBeUndefined();
});
```

`pack-layout.test.ts` — append:

```ts
it('re-applies a saved layout over the packed positions', () => {
  const model = buildModel(); // packs everything
  model._savedLayout = {
    entities: new Map([['users', { x: 1111, y: 222 }]]),
    groups: new Map([['z1', { x: 900, y: 10, w: 640, h: 480 }]]),
  };
  packLayout(model);
  expect(model.entityById.get('users')!.x).toBe(1111);
  const z1 = model._groupBounds.find((b) => b.id === 'z1')!;
  expect({ x: z1.x, y: z1.y, w: z1.w, h: z1.h }).toEqual({ x: 900, y: 10, w: 640, h: 480 });
  expect(model._content.w).toBeGreaterThanOrEqual(1111); // content covers moved card
});
```

- [ ] **Step 2: Run — confirm both fail** (`colors`/`_savedLayout` not on Model).

- [ ] **Step 3: Implement**

`types.ts` — add to `Model` (after `kindStyle`):

```ts
  colors: ReadonlyMap<string, string>; // saved colour overrides (id → hex); ui seeds from this
  _savedLayout?: SavedLayout; // hand-arranged positions from the file; pack re-applies them
```

and export:

```ts
export interface SavedLayout {
  entities: Map<string, { x: number; y: number }>;
  groups: Map<string, { x: number; y: number; w: number; h: number }>;
}
```

`load-model.ts` — where the returned model object is assembled, add `colors` and `_savedLayout`:

```ts
  const colors = new Map<string, string>();
  if (r.colors && typeof r.colors === 'object')
    for (const [k, v] of Object.entries(r.colors as Record<string, unknown>))
      if (typeof v === 'string') colors.set(k, v);

  const savedEntities = new Map<string, { x: number; y: number }>();
  for (const e of entities || [])
    if (typeof e.x === 'number' && typeof e.y === 'number') savedEntities.set(e.id, { x: e.x, y: e.y });
  const savedGroups = new Map<string, { x: number; y: number; w: number; h: number }>();
  for (const g of groups || [])
    if (g.bounds && ['x', 'y', 'w', 'h'].every((k) => typeof g.bounds[k] === 'number'))
      savedGroups.set(g.id, { x: g.bounds.x, y: g.bounds.y, w: g.bounds.w, h: g.bounds.h });
  const savedLayout = savedEntities.size || savedGroups.size ? { entities: savedEntities, groups: savedGroups } : undefined;
```

and include `colors,` and `_savedLayout: savedLayout,` in the returned model literal.

`pack-layout.ts` — at the end of `packLayout`, after `_content` is set, re-apply:

```ts
  const saved = model._savedLayout;
  if (saved) {
    for (const [id, p] of saved.entities) {
      const e = model.entityById.get(id);
      if (e) { e.x = p.x; e.y = p.y; }
    }
    for (const [id, b] of saved.groups) {
      const g = model._groupBounds.find((x) => x.id === id);
      if (g) { g.x = b.x; g.y = b.y; g.w = b.w; g.h = b.h; }
    }
    let w = model._content.w;
    let h = model._content.h;
    for (const e of model.entities) { w = Math.max(w, e.x + e._w + 80); h = Math.max(h, e.y + e._h + 80); }
    for (const g of model._groupBounds) { w = Math.max(w, g.x + g.w + 80); h = Math.max(h, g.y + g.h + 80); }
    model._content = { w, h };
  }
```

- [ ] **Step 4: Run tests + full suite + typecheck — green.**

- [ ] **Step 5: Commit**

```bash
git add apps/eer/src/engine/model/types apps/eer/src/engine/model/load-model apps/eer/src/engine/layout/pack-layout
git commit -m "feat(eer): raw models carry colours and a saved layout; pack honors them"
```

### Task A2: `serialize-model` (Model → raw JSON, roundtrip-safe)

**Files:**
- Create: `apps/eer/src/engine/model/serialize-model/serialize-model.ts`, `index.ts`
- Test: `apps/eer/src/engine/model/serialize-model/serialize-model.test.ts`

**Interfaces:**
- Consumes: `Model`, `Field`, `Group`, `Relationship` from `../types`; A1's `colors`.
- Produces: `serializeModel(model: Model, colors: ReadonlyMap<string, string>): Record<string, unknown>` — raw JSON with meta, view.routing, kinds, colors, groups (+bounds from `_groupBounds`), entities (+x/y, full fields), and only relationships whose `kind !== 'fk'` (fk edges are derived from fields on load — see A4).

- [ ] **Step 1: Failing test**

```ts
import { describe, expect, it } from 'vitest';

import { buildModel } from '../../../test/models';
import { loadModel } from '../load-model';
import { packLayout } from '../../layout/pack-layout';
import { serializeModel } from './serialize-model';

describe('serializeModel', () => {
  it('roundtrips: loading the serialized form reproduces entities, fields, colors and layout', () => {
    const m1 = buildModel();
    const colors = new Map([['z1', '#123456']]);
    const raw = serializeModel(m1, colors);
    const { model: m2, errors } = loadModel(raw);
    expect(errors).toEqual([]);
    packLayout(m2!);
    expect(m2!.entities.map((e) => e.id)).toEqual(m1.entities.map((e) => e.id));
    expect(m2!.entityById.get('orders')!.fields).toEqual(m1.entityById.get('orders')!.fields);
    expect(m2!.colors.get('z1')).toBe('#123456');
    expect(m2!.entityById.get('users')!.x).toBe(m1.entityById.get('users')!.x); // layout survived
    // fk relationships are re-derived on load, non-fk kinds are serialized explicitly
    expect(m2!.relationships.map((r) => r.id).sort()).toEqual(m1.relationships.map((r) => r.id).sort());
  });
});
```

Note: this roundtrip asserts the **A4 derivation contract** (fk rels re-derived from fields). Until A4 lands, `loadModel` only reads explicit relationships — so in THIS task serialize ALL relationships (fk included) and add a `// TODO(A4)` marker is forbidden; instead: serialize all relationships now, and A4's task flips `serializeModel` to skip fk-kind rels in the same commit that adds derivation. For this task the roundtrip test asserts equality with all rels serialized.

- [ ] **Step 2: Run — fails (module missing).**

- [ ] **Step 3: Implement**

```ts
// Model → raw JSON file shape. Inverse of load-model for everything the editor
// touches: meta, kinds, colours, groups+bounds, entities+positions+fields, and
// relationships. Underscore-prefixed derived state is never serialized.

import type { Model } from '../types';

export function serializeModel(model: Model, colors: ReadonlyMap<string, string>): Record<string, unknown> {
  const bounds = new Map(model._groupBounds.map((b) => [b.id, { x: b.x, y: b.y, w: b.w, h: b.h }]));
  return {
    meta: { title: model.meta.title ?? '', description: model.meta.description ?? '' },
    view: { routing: model.view.routing },
    kinds: model.kinds.map((k) => ({ id: k.id, label: k.label, style: k.style })),
    colors: Object.fromEntries(colors),
    groups: model.groups.map((g) => ({
      id: g.id,
      label: g.label,
      order: g.order,
      ...(g.parent ? { parent: g.parent } : {}),
      ...(bounds.has(g.id) ? { bounds: bounds.get(g.id) } : {}),
    })),
    entities: model.entities.map((e) => ({
      id: e.id,
      label: e.label,
      group: e.group,
      ...(e.description ? { description: e.description } : {}),
      x: e.x,
      y: e.y,
      fields: e.fields.map((f) => ({
        name: f.name,
        type: f.type,
        ...(f.role ? { role: f.role } : {}),
        ...(f.ref ? { ref: f.ref, refField: f.refField ?? 'id' } : {}),
        ...(f.title ? { title: f.title } : {}),
        ...(f.description ? { description: f.description } : {}),
      })),
    })),
    relationships: model.relationships.map((r) => ({
      id: r.id,
      source: r.source,
      sourceField: r.sourceField,
      target: r.target,
      targetField: r.targetField,
      ...(r.kind ? { kind: r.kind } : {}),
      ...(r.label ? { label: r.label } : {}),
      cardinality: r.cardinality,
    })),
  };
}
```

(Check `EdgeKind` has `style` — if the loaded kind stores style only in `kindStyle`, serialize `style: model.kindStyle.get(k.id) === 'dashed' ? 'dashed' : 'solid'` instead.)

- [ ] **Step 4: Run tests + typecheck — green.**
- [ ] **Step 5: Commit**

```bash
git add apps/eer/src/engine/model/serialize-model
git commit -m "feat(eer): serialize-model — inverse of load-model incl. layout and colours"
```

### Task A3: Models API — Vite dev middleware + seed file

**Files:**
- Create: `apps/eer/vite-plugins/models-api.ts`
- Create: `apps/eer/models/items-platform.json` (copy of `apps/eer/src/model/eer-model.json`)
- Modify: `apps/eer/vite.config.ts`
- Test: `apps/eer/src/test/models-api.test.ts` (imports from `../../vite-plugins/models-api`)

**Interfaces:**
- Produces: `handleModelsRequest(dir: string, method: string, url: string, body: string | null): Promise<{ status: number; body: unknown }>` (pure-ish, fs-only) and `modelsApiPlugin(dir?: string): Plugin` wiring it at `/api/models`. Route contract exactly as the spec table (list/get/post/put/delete, 422 invalid body, 400 bad slug, 404 missing, 409 collision).

- [ ] **Step 1: Failing tests**

```ts
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { handleModelsRequest } from '../../vite-plugins/models-api';

const VALID = JSON.stringify({
  meta: { title: 'T' },
  groups: [{ id: 'z', label: 'Z' }],
  entities: [{ id: 'e', group: 'z', fields: [{ name: 'id', type: 'serial', role: 'pk' }] }],
});

const dir = () => mkdtempSync(join(tmpdir(), 'eer-models-'));

describe('models api', () => {
  it('lists, creates, gets, saves and deletes models', async () => {
    const d = dir();
    expect((await handleModelsRequest(d, 'GET', '/', null)).body).toEqual([]);
    const created = await handleModelsRequest(d, 'POST', '/', VALID);
    expect(created.status).toBe(201);
    const id = (created.body as { id: string }).id;
    expect(id).toBe('t');
    expect(((await handleModelsRequest(d, 'GET', '/', null)).body as unknown[]).length).toBe(1);
    expect((await handleModelsRequest(d, 'GET', `/${id}`, null)).status).toBe(200);
    expect((await handleModelsRequest(d, 'PUT', `/${id}`, VALID)).status).toBe(200);
    expect(JSON.parse(readFileSync(join(d, 't.json'), 'utf8')).meta.title).toBe('T');
    expect((await handleModelsRequest(d, 'DELETE', `/${id}`, null)).status).toBe(200);
    expect((await handleModelsRequest(d, 'GET', `/${id}`, null)).status).toBe(404);
  });

  it('rejects traversal slugs, invalid bodies, and duplicate titles', async () => {
    const d = dir();
    expect((await handleModelsRequest(d, 'GET', '/../secrets', null)).status).toBe(400);
    expect((await handleModelsRequest(d, 'POST', '/', '{"groups":[]}')).status).toBe(422);
    await handleModelsRequest(d, 'POST', '/', VALID);
    expect((await handleModelsRequest(d, 'POST', '/', VALID)).status).toBe(409);
  });
});
```

- [ ] **Step 2: Run — fails (module missing).**

- [ ] **Step 3: Implement `vite-plugins/models-api.ts`**

```ts
// Dev-only file-backed models API: apps/eer/models/<slug>.json behind
// /api/models. handleModelsRequest is the whole behavior (unit-testable);
// the plugin just adapts it to connect middleware. NOT part of the built app.

import { existsSync, mkdirSync } from 'node:fs';
import { readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Plugin } from 'vite';

import { loadModel } from '../src/engine/model/load-model';

const SLUG = /^[a-z0-9-]+$/;

function slugify(title: string): string {
  return title.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-').replaceAll(/^-+|-+$/g, '') || 'model';
}

async function atomicWrite(dir: string, slug: string, json: string): Promise<void> {
  const tmp = join(dir, `.${slug}.tmp`);
  await writeFile(tmp, json, 'utf8');
  await rename(tmp, join(dir, `${slug}.json`));
}

function validate(body: string | null): { raw?: Record<string, unknown>; error?: { status: number; body: unknown } } {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(body ?? '') as Record<string, unknown>;
  } catch {
    return { error: { status: 400, body: { error: 'Body must be JSON.' } } };
  }
  const { errors } = loadModel(raw);
  if (errors.length) return { error: { status: 422, body: { error: errors.join(' ') } } };
  return { raw };
}

export async function handleModelsRequest(
  dir: string,
  method: string,
  url: string,
  body: string | null,
): Promise<{ status: number; body: unknown }> {
  mkdirSync(dir, { recursive: true });
  const slug = decodeURIComponent(url.replace(/^\//, '').split('?')[0] ?? '');

  if (!slug) {
    if (method === 'GET') {
      const files = (await readdir(dir)).filter((f) => f.endsWith('.json'));
      const list = await Promise.all(
        files.map(async (f) => {
          const raw = JSON.parse(await readFile(join(dir, f), 'utf8')) as { meta?: { title?: string } };
          return { id: f.replace(/\.json$/, ''), title: raw.meta?.title ?? f };
        }),
      );
      return { status: 200, body: list.sort((a, b) => a.id.localeCompare(b.id)) };
    }
    if (method === 'POST') {
      const v = validate(body);
      if (v.error) return v.error;
      const title = ((v.raw!.meta as { title?: string } | undefined)?.title ?? 'model').toString();
      const id = slugify(title);
      if (existsSync(join(dir, `${id}.json`))) return { status: 409, body: { error: `Model "${id}" already exists.` } };
      await atomicWrite(dir, id, JSON.stringify(v.raw, null, 2));
      return { status: 201, body: { id } };
    }
    return { status: 405, body: { error: 'Method not allowed.' } };
  }

  if (!SLUG.test(slug)) return { status: 400, body: { error: 'Bad model id.' } };
  const file = join(dir, `${slug}.json`);
  if (method === 'GET') {
    if (!existsSync(file)) return { status: 404, body: { error: 'Not found.' } };
    return { status: 200, body: JSON.parse(await readFile(file, 'utf8')) };
  }
  if (method === 'PUT') {
    const v = validate(body);
    if (v.error) return v.error;
    await atomicWrite(dir, slug, JSON.stringify(v.raw, null, 2));
    return { status: 200, body: { id: slug } };
  }
  if (method === 'DELETE') {
    if (!existsSync(file)) return { status: 404, body: { error: 'Not found.' } };
    await rm(file);
    return { status: 200, body: { id: slug } };
  }
  return { status: 405, body: { error: 'Method not allowed.' } };
}

export function modelsApiPlugin(dir = join(process.cwd(), 'models')): Plugin {
  return {
    name: 'eer-models-api',
    configureServer(server) {
      server.middlewares.use('/api/models', (req, res) => {
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          void handleModelsRequest(dir, req.method ?? 'GET', req.url ?? '/', chunks.length ? Buffer.concat(chunks).toString('utf8') : null)
            .then(({ status, body }) => {
              res.statusCode = status;
              res.setHeader('content-type', 'application/json');
              res.end(JSON.stringify(body));
            })
            .catch((err: unknown) => {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: String(err) }));
            });
        });
      });
    },
  };
}
```

`vite.config.ts`:

```ts
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { modelsApiPlugin } from './vite-plugins/models-api';

export default defineConfig({
  plugins: [react(), tailwindcss(), modelsApiPlugin()],
  server: {
    port: Number(process.env.EER_DEV_PORT ?? 4630),
    strictPort: true,
  },
});
```

Seed: `cp apps/eer/src/model/eer-model.json apps/eer/models/items-platform.json`.

- [ ] **Step 4: Run tests + typecheck — green.** Also smoke: `curl -s localhost:4630/api/models` with dev server up → seed listed.
- [ ] **Step 5: Commit**

```bash
git add apps/eer/vite-plugins apps/eer/models apps/eer/vite.config.ts apps/eer/src/test/models-api.test.ts
git commit -m "feat(eer): file-backed models API as vite dev middleware + seed model"
```

### Task A4: `apply-model-edit` — pure structural edits + FK-derived relationships

**Files:**
- Create: `apps/eer/src/engine/model/apply-model-edit/apply-model-edit.ts`, `index.ts`
- Test: `apps/eer/src/engine/model/apply-model-edit/apply-model-edit.test.ts`
- Modify: `apps/eer/src/engine/model/serialize-model/serialize-model.ts` (skip fk-kind rels) + its test

**Interfaces:**
- Consumes: `measureEntity` from `../../geometry/measure-entity`, `inferCardinality` (see `load-model.ts` for how it derives cardinality), `Model`, `Entity`, `Field`, `Group`.
- Produces (exported from the module):

```ts
export interface EditField {
  name: string; type: string; role: 'pk' | 'fk' | null;
  ref: string | null; refField: string | null; description: string | null;
}
export type ModelEdit =
  | { kind: 'setMeta'; title: string; description: string }
  | { kind: 'upsertGroup'; group: { id: string; label: string; parent: string | null } }
  | { kind: 'deleteGroup'; id: string }
  | { kind: 'upsertEntity'; entity: { id: string; label: string; group: string; description: string | null; fields: EditField[] } }
  | { kind: 'deleteEntity'; id: string };
export function applyModelEdit(model: Model, edit: ModelEdit): Model; // throws Error with a user-readable message on invalid edits
export function fkRefsTo(model: Model, entityId: string): { entityId: string; field: string }[]; // for delete-confirm copy
```

Behavior contract (each bullet gets a test):
- `setMeta` replaces `meta` immutably.
- `upsertGroup` adds or relabels/reparents; `deleteGroup` throws `"Group still contains N table(s)"` when members exist and `"Group has subgroups"` when children exist.
- `upsertEntity` (new): measures via `measureEntity`, spawns at its group's bounds `+50/+50` (or `50/50` when the group has no box yet), rebuilds `entityById`.
- `upsertEntity` (existing): replaces label/group/description/fields, keeps x/y/_w recomputed by `measureEntity`.
- `deleteEntity`: removes entity, drops its relationships, and **clears** `role/ref/refField` on other entities' fields that referenced it.
- After every edit, `relationships` = explicit non-fk rels that still have valid endpoints + one derived rel per fk field: `id: 'e-<ref>.<refField>-><entity>.<field>'`, `source: ref`, `sourceField: refField ?? 'id'`, `target: entity.id`, `targetField: field.name`, `kind: 'fk'`, `cardinality: '1-n'` (inferred pk→fk), `relById` rebuilt.
- Group boxes: a brand-new group gets a `_groupBounds` box at `(content.w + 80, 40, 360, 260)`; deleting a group removes its box; content extents grow to cover new boxes.

- [ ] **Step 1: Write the tests** — one `it` per contract bullet above, using `buildModel()` and hand-built edits. Example shape (write ALL bullets in this style):

```ts
it('deleteEntity clears fk fields pointing at it and drops its edges', () => {
  const m1 = buildModel(); // users ← orders.users_id (fk)
  const m2 = applyModelEdit(m1, { kind: 'deleteEntity', id: 'users' });
  expect(m2.entityById.has('users')).toBe(false);
  const f = m2.entityById.get('orders')!.fields.find((x) => x.name === 'users_id')!;
  expect(f.role).toBeNull();
  expect(f.ref).toBeNull();
  expect(m2.relationships.some((r) => r.source === 'users' || r.target === 'users')).toBe(false);
  expect(m1.entityById.has('users')).toBe(true); // input untouched
});

it('an fk field derives its relationship; clearing the role removes it', () => {
  const m1 = buildModel();
  const tags = m1.entityById.get('tags')!;
  const withFk = applyModelEdit(m1, {
    kind: 'upsertEntity',
    entity: {
      id: 'tags', label: tags.label, group: tags.group, description: null,
      fields: [
        { name: 'id', type: 'int', role: 'pk', ref: null, refField: null, description: null },
        { name: 'owner_id', type: 'int', role: 'fk', ref: 'users', refField: 'id', description: null },
      ],
    },
  });
  expect(withFk.relationships.some((r) => r.source === 'users' && r.target === 'tags' && r.targetField === 'owner_id')).toBe(true);
});
```

- [ ] **Step 2: Run — red.**
- [ ] **Step 3: Implement** the module: a `switch` over `edit.kind`, each branch building a new `Model` via object spread, then one shared `finalize(model)` that rebuilds `entityById`, regenerates relationships per the contract, rebuilds `relById`, and grows `_content`. Derived-rel generation:

```ts
function deriveRelationships(model: Model): Relationship[] {
  const explicit = model.relationships.filter(
    (r) => r.kind !== 'fk' && model.entityById.has(r.source) && model.entityById.has(r.target),
  );
  const derived: Relationship[] = [];
  for (const e of model.entities)
    for (const f of e.fields)
      if (f.role === 'fk' && f.ref && model.entityById.has(f.ref))
        derived.push({
          id: `e-${f.ref}.${f.refField ?? 'id'}->${e.id}.${f.name}`,
          source: f.ref, sourceField: f.refField ?? 'id',
          target: e.id, targetField: f.name,
          cardinality: '1-n', cardinalityInferred: true, kind: 'fk', label: null,
        });
  return [...explicit, ...derived];
}
```

- [ ] **Step 4: Flip `serializeModel`** to skip `kind === 'fk'` relationships and update its roundtrip test (fk rels now reappear via `deriveRelationships`… but plain `loadModel` does NOT derive — so `loadModel` must also learn one thing: **when a raw file has fk fields with refs and no matching explicit relationship, derive it on load**. Add that to `load-model.ts` reusing the same id scheme, with a test: raw with fk field and empty `relationships` loads with one derived relationship.)
- [ ] **Step 5: Full suite + typecheck — green.**
- [ ] **Step 6: Commit**

```bash
git add apps/eer/src/engine/model/apply-model-edit apps/eer/src/engine/model/serialize-model apps/eer/src/engine/model/load-model
git commit -m "feat(eer): apply-model-edit with fk-derived relationships; load derives fk edges"
```

### Task A5: Reducer + provider — `APPLY_MODEL_EDIT`, dirty flag, colour seeding

**Files:**
- Modify: `apps/eer/src/state/diagram-reducer/diagram-reducer.ts`
- Modify: `apps/eer/src/state/diagram-provider/diagram-provider.tsx`
- Test: `apps/eer/src/state/diagram-reducer/diagram-reducer.test.ts`

**Interfaces:**
- Consumes: `applyModelEdit`, `ModelEdit` from A4; `Model.colors` from A1.
- Produces: `DiagramUi` gains `dirty: boolean` and `modelId: string | null`; actions `{ type: 'APPLY_MODEL_EDIT'; edit: ModelEdit }` and `{ type: 'MARK_SAVED' }`; `LOAD` becomes `{ type: 'LOAD'; model: Model; modelId?: string }` seeding `ui.colors` from `model.colors` and resetting `dirty`; `SET_POSITIONS`, `RESIZE_GROUP`, `SET_COLORS`, `APPLY_MODEL_EDIT` set `dirty: true`. `DiagramActions` gains `applyModelEdit(edit: ModelEdit): void` and `markSaved(): void`; `load(model, modelId?)`.

- [ ] **Step 1: Reducer tests (red)** — in the existing test file's style:

```ts
it('LOAD seeds colors from the model, stores the model id, and clears dirty', () => { /* dispatch LOAD with model.colors set; assert ui.colors, ui.modelId, ui.dirty === false */ });
it('APPLY_MODEL_EDIT rewrites the model immutably and sets dirty', () => { /* setMeta edit; assert new title + dirty */ });
it('SET_COLORS and SET_POSITIONS set dirty; MARK_SAVED clears it', () => { /* … */ });
```

Write these three with real dispatch calls against `diagramReducer` — follow the existing tests in the file for how a loaded state is prepared.

- [ ] **Step 2: Implement** — `ui.dirty`/`ui.modelId` in `DiagramUi` + `initialDiagramState`; new cases:

```ts
    case 'APPLY_MODEL_EDIT': {
      if (!state.model) return state;
      return { ...state, model: applyModelEdit(state.model, action.edit), ui: { ...state.ui, dirty: true } };
    }
    case 'MARK_SAVED':
      return { ...state, ui: { ...state.ui, dirty: false } };
```

and inside the existing `LOAD` case: `colors: action.model.colors ?? new Map()`, `modelId: action.modelId ?? null`, `dirty: false`; add `dirty: true` to the `SET_COLORS`, `SET_POSITIONS`, `RESIZE_GROUP` cases. Provider: add `applyModelEdit: (edit) => dispatch({ type: 'APPLY_MODEL_EDIT', edit })` and `markSaved: () => dispatch({ type: 'MARK_SAVED' })`; thread `modelId` through `load`.

- [ ] **Step 3: Full suite + typecheck — green.**
- [ ] **Step 4: Commit**

```bash
git add apps/eer/src/state
git commit -m "feat(eer): APPLY_MODEL_EDIT reducer action, dirty tracking, colour seeding"
```

### Task A6: Models client + TopBar (dropdown, new, save)

**Files:**
- Create: `apps/eer/src/api/models-client.ts` (plain fetch wrappers; no folder-per-function — this is app glue, not engine)
- Create: `apps/eer/src/components/top-bar/model-menu.tsx`
- Modify: `apps/eer/src/components/top-bar/top-bar.tsx`, `apps/eer/src/hooks/use-model-loader/use-model-loader.ts`
- Test: `apps/eer/src/components/top-bar/model-menu.test.tsx`

**Interfaces:**
- Consumes: A3 routes, A5 actions (`load(model, modelId)`, `markSaved`, `ui.dirty`, `ui.modelId`), A2 `serializeModel`.
- Produces: `models-client.ts` exports `listModels(): Promise<{ id: string; title: string }[] | null>` (null on network/404 → editor hidden), `getModel(id): Promise<unknown>`, `createModel(raw): Promise<{ id: string } | { error: string }>`, `saveModel(id, raw): Promise<boolean>`, `deleteModel(id): Promise<boolean>`. `ModelMenu` component renders: `<select>` of models (value = `ui.modelId`), New (prompt-modal in A7 — until then `window.prompt` is forbidden; render a disabled New button with `title="lands with modals"`), Save button showing a dirty dot, hidden entirely when `listModels()` resolved null.
- `use-model-loader` priority: `?model=` URL (unchanged) → `?id=<slug>` via API → first listed model → bundled default.

- [ ] **Step 1: Component test (red)** — mock `models-client` with `vi.mock`; assert: dropdown lists titles; selecting dispatches a load of the fetched model; selecting while `ui.dirty` first shows a `window.confirm`-free inline confirm (a small `Discard unsaved changes?` bar with Discard/Cancel buttons rendered by `ModelMenu`) and only loads on Discard; Save calls `saveModel(ui.modelId, serializeModel(...))` then `markSaved`; menu hidden when list is null.
- [ ] **Step 2: Implement** client + `ModelMenu` (uses `useDiagramModelOrNull`/`useDiagramUi`/`useDiagramActions`; loads via `loadModel(rawFromApi)` then `actions.load(model, id)`); insert `<ModelMenu />` in `top-bar.tsx` before `<SearchBox />`. Style with existing `btn` classes / `border-border bg-surface text-sm` tokens; the native `<select>` gets `bg-surface text-ink border border-border rounded-md px-2 py-1 text-sm`.
- [ ] **Step 3: Full suite + typecheck + live smoke** (dev server: dropdown shows `items-platform`, switching reloads, Save round-trips — confirm file mtime changes).
- [ ] **Step 4: Commit**

```bash
git add apps/eer/src/api apps/eer/src/components/top-bar apps/eer/src/hooks/use-model-loader
git commit -m "feat(eer): model menu — list/select/save against the models API"
```

### Task A7: Modal primitive + model/group modals + create chooser

**Files:**
- Create: `apps/eer/src/components/modal/modal.tsx`, `index.ts`, `modal.test.tsx`
- Create: `apps/eer/src/components/editor/editor-modals.tsx` (modal-routing state: which modal is open, for which id), `editor-context.ts`, `group-modal.tsx`, `model-modal.tsx`, `add-chooser.tsx`, `index.ts`
- Modify: `apps/eer/src/components/top-bar/top-bar.tsx` (＋ Add button + New model wiring), `apps/eer/src/components/eer-viewer/eer-viewer.tsx` (mount `<EditorModals />`)
- Test: `apps/eer/src/components/editor/group-modal.test.tsx`

**Interfaces:**
- Consumes: A5 `actions.applyModelEdit`, A6 client (`createModel`, `deleteModel`).
- Produces: `Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode })` — fixed overlay `bg-bg/60`, panel `bg-surface border border-border rounded-lg`, closes on Esc and backdrop click; `EditorContext` exposing `openModal(m: EditorModal)` / `closeModal()` where

```ts
export type EditorModal =
  | { kind: 'model' }            // edit meta / delete current model
  | { kind: 'new-model' }        // title input → createModel(seededRaw(title)) → load it
  | { kind: 'add' }              // chooser: zone / subgroup / table → opens group/table modal in create mode
  | { kind: 'group'; id?: string }
  | { kind: 'table'; id?: string };
```

- New-model seed (in `model-modal.tsx`):

```ts
export function seededRaw(title: string): Record<string, unknown> {
  return {
    meta: { title, description: '' },
    view: { routing: 'avoid' },
    kinds: [{ id: 'fk', label: 'FK constraint' }],
    groups: [{ id: 'main', label: 'Main', order: 0 }],
    entities: [{ id: 'table_1', label: 'table_1', group: 'main', fields: [{ name: 'id', type: 'serial', role: 'pk' }] }],
  };
}
```

- Group modal fields: name, kind radio (zone / subgroup + parent-zone select), colour swatch writing through `actions.setColors` (same override map semantics as the colours form); id generated `slugify(name)` on create, shown read-only on edit; Delete button disabled with the blocking reason when members/subgroups exist (use `fkRefsTo`-style helpers: count `model.entities.filter(e => e.group === id)` and `model.groups.filter(g => g.parent === id)`).
- A6's disabled New button becomes live: opens `{ kind: 'new-model' }`.

- [ ] **Step 1: Tests (red)** — modal: renders children, Esc calls `onClose`; group modal: create dispatches `upsertGroup` with slugified id; delete disabled when the group has tables (assert `toBeDisabled` + reason in `title`).
- [ ] **Step 2: Implement.** Keep every file ≤ ~120 lines; shared input styling string `field = 'w-full rounded-md border border-border bg-surface-2 px-2 py-1 text-sm text-ink'`.
- [ ] **Step 3: Full suite + typecheck — green;** live smoke: create zone, create subgroup under it, rename, blocked delete message.
- [ ] **Step 4: Commit**

```bash
git add apps/eer/src/components/modal apps/eer/src/components/editor apps/eer/src/components/top-bar/top-bar.tsx apps/eer/src/components/eer-viewer
git commit -m "feat(eer): modal primitive, model/new/add/group modals"
```

### Task A8: Table modal with field grid

**Files:**
- Create: `apps/eer/src/components/editor/table-modal.tsx`, `field-grid.tsx`
- Modify: `apps/eer/src/components/editor/editor-modals.tsx` (route `{ kind: 'table' }`)
- Test: `apps/eer/src/components/editor/table-modal.test.tsx`

**Interfaces:**
- Consumes: A4 `ModelEdit`/`EditField`/`fkRefsTo`, A5 `actions.applyModelEdit`, A7 `Modal`/`EditorContext`.
- Produces: table modal — name, group select, description, and a **colour override row** (checkbox + swatch writing `actions.setColors`, same semantics as the colours form — checked = own entry in the override map); local `useState<EditField[]>` draft; rows: name input · type input · role select (–/PK/FK) · ref-table select + ref-field select (both disabled unless FK; ref-field lists the target's fields) · note input · ↑ ↓ · ✕; Add field appends `{ name: '', type: 'text', role: null, ref: null, refField: null, description: null }`; Save validates (non-empty unique names, FK rows need a ref) and dispatches ONE `upsertEntity`; Delete shows `fkRefsTo(model, id)` in the confirm copy then dispatches `deleteEntity` and `closeModal` + `actions.clearSelection()`.

- [ ] **Step 1: Tests (red)** — renders a row per existing field; role→FK enables ref selects; Save dispatches `upsertEntity` whose `fields` reflect an added row; Delete confirm lists `orders.users_id` when deleting `users` (fixture model); duplicate field names block Save with a message.
- [ ] **Step 2: Implement** (`field-grid.tsx` owns rows; `table-modal.tsx` owns draft state + validation + danger zone).
- [ ] **Step 3: Full suite + typecheck; live smoke** — add a field to `comments`, save model, reload page, field survived.
- [ ] **Step 4: Commit**

```bash
git add apps/eer/src/components/editor
git commit -m "feat(eer): table modal with field grid, fk refs, guarded delete"
```

### Task A9: Detail-panel edit buttons + end-to-end pass

**Files:**
- Modify: `apps/eer/src/components/detail-panel/entity-detail.tsx`, `group-detail.tsx` (Edit button in the header row → `openModal({ kind: 'table' | 'group', id })`)
- Modify: `apps/eer/README.md` (editor + API section)
- Test: extend `apps/eer/src/components/detail-panel/detail-panel.test.tsx`

**Interfaces:**
- Consumes: A7 `EditorContext`.

- [ ] **Step 1: Test (red):** selecting an entity renders an `Edit` button; clicking it opens the table modal (assert by role/dialog title).
- [ ] **Step 2: Implement** the two buttons (reuse the `btn` styling from `top-bar.tsx`).
- [ ] **Step 3: End-to-end (the spec's acceptance walk):** dev server → New model → add zone + 2 tables → FK-link them via the table modal → drag layout → recolour a table → Save → hard reload → everything (data, layout, colours) survived; `models/<slug>.json` diff shows it all. Screenshot.
- [ ] **Step 4: Full suite + typecheck one last time.**
- [ ] **Step 5: Commit**

```bash
git add apps/eer/src/components/detail-panel apps/eer/README.md
git commit -m "feat(eer): edit entry points in the detail panel; editor docs"
```
