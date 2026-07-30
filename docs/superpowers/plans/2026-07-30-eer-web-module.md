# EER Web Module Implementation Plan (Phase 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `/schema`'s static legacy ERD with the interactive eer diagram — pan, zoom, drag, orthogonal routing, focus sets, search — moved into `apps/web` as a generic prop-driven module themed on Instrument.

**Architecture:** `apps/eer`'s calculation engine, state, gestures and view components move to `apps/web/src/components/eer/` as a read-only controlled component: `<EerDiagram model={...} />`. A pure adapter turns the `SchemaGraph` Phase 1 already produces into the eer `Model`. eer's private dark-only `@theme` is deleted and its ~440 colour utilities are remapped onto Instrument's 12-step scale, which makes the diagram light/dark aware for free. The drizzle round-trip goes to `packages/db`; `apps/eer` and the legacy renderer are deleted.

**Tech Stack:** TypeScript, React 19, Tailwind v4 (preflight ON in web), `@tickets/ui` Instrument tokens, TanStack Router/Query, vitest + jsdom.

Spec: [`docs/superpowers/specs/2026-07-30-schema-browser-design.md`](../specs/2026-07-30-schema-browser-design.md)
Phase 1 (live introspection) is complete on `feat/live-schema-introspection`.

## Global Constraints

- **Read-only.** No editing. The editor (`components/editor/`, 36 files), `models-client.ts`, the models file API and `use-model-loader` do not move. `colors-form.tsx` (a colour-override editor in `detail-panel/`) does not move either.
- **The model arrives as a prop.** The module performs no fetching, reads no URL params, and imports no Signals SDK. `apps/web/src/routes/schema-route.tsx` owns fetching; the diagram renders what it is handed.
- **`apply-model-edit`, `serialize-model`, `pg-types` and `descriptors` DO move** — they look like editor code but are load-bearing. `diagram-reducer.ts` routes every edit through `applyModelEdit`, and dragging a card *is* a model edit (x/y). `load-model` needs `parseType`/`formatType`.
- **`engine/` must move byte-identical apart from colour tokens.** It has no DOM or React imports. Its ~45 tests must pass **unchanged** — that is the signal that the move changed nothing.
- **The route must render inside `<AppShell>`.** Phase 1 shipped a Critical defect where `/schema` was not wrapped, so the rail and panel never mounted and 1,079 tests stayed green. `schema-route.tsx` is already fixed; do not regress it, and keep the test that asserts the rail renders.
- **No raw `style` props, no arbitrary Tailwind values.** `apps/web/src` is scanned by `@tickets/ui`'s `tokens:verify`. Runtime geometry enters via typed CSS custom properties and `runtimeStyle` from `@tickets/ui` — that pattern already exists in eer and is allowed.
- **`@tickets/ui`'s `cn` and `runtimeStyle` stay.** eer already imports them in ~40 files; that dependency is correct and continues.
- Conventional commits scoped by app: `refactor(web):`, `feat(web):`, `refactor(db):`, `chore:`.

## Verified environment facts

Confirmed against the worktree before this plan was written.

- **Files to move:** `engine/` 145, `state/` 7, `hooks/` 8, `ui/` 1, `components/diagram/` 21, `components/detail-panel/` 21, `components/top-bar/` 9, `components/error-banner/` 3, `components/modal/` 3, `components/eer-viewer/` 3. Minus what stays behind (below), roughly **205 files, ~62 of them tests**.
- **Colour rungs in use (non-test):** `gray` 50/100/200/300/400/500/600/700/800/900/950; `red` 200/300/400/600/700/950; `yellow` 400/600/950; `blue` 300/400/500/600/900; `green` 400; `violet` 200/300/400. ~440 occurrences.
- **Instrument has NO `--tracking-*` and NO `--shadow-md/lg/xl`**, and does not reset either family — so those classes silently fall back to *Tailwind's* built-in defaults rather than anything Instrument designed. Instrument's shadows are semantic: `shadow-raised`, `shadow-overlay`, `shadow-modal`.
- **Retired radius forms present in eer:** `rounded-2xl` ×1, plus bare `rounded-t`, `rounded-r`, `rounded-l`, `rounded-br` (one each). Bare `rounded-<side>` with no rung is a retired form in Instrument's ratchet and will fail `tokens:verify` once these files land in `apps/web/src`.
- **`--transition-paint`** is an eer-only `@theme` variable used at 3 sites via `transition-(--transition-paint)`. It has no Instrument equivalent.
- **`duration-120`** (4 sites) is not a token in either theme; Tailwind v4 generates it natively from the numeric value.
- **Viewport coupling:** `eer-viewer.tsx:13` uses `flex h-screen flex-col`. Inside `AppShell`'s `<main>` (already `flex-1 overflow-auto`) that causes a double scrollbar and a clipped diagram.
- `apps/web` tests: vitest + jsdom, setup `apps/web/src/test/setup.ts`. Suites currently: db 406, api 280 (+1 skip), web 403.

## Lessons from Phase 1 — every task must honour these

Phase 1 produced 14 findings; 12 were in tests. The recurring failure modes:

1. **Tests that assert nothing.** Several passed against deliberately broken code. Where this plan gives a concrete expected value, assert it exactly — never `typeof x === 'string'` or `length > 0`.
2. **Using the default value as the test value.** A test that exercises a parameter using its own default cannot tell "honoured" from "ignored."
3. **Unit tests that miss the wiring.** Every reader was individually correct while the assembly between them was unguarded. Test the seam, not just the parts.
4. **Green tests ≠ working feature.** The Critical Phase 1 defect passed every suite because no test asked whether the thing appeared in the running app.
5. **Run `typecheck`, not just tests.** Eight commits landed with a red `tsc` because only vitest was run.

**Every task ends with `pnpm --filter @tickets/web typecheck` clean, and any task touching classes also runs `pnpm verify:tokens`.**

## File Structure

**Destination — `apps/web/src/components/eer/`:**

| Path | Responsibility |
|---|---|
| `engine/` | Pure calculation: geometry, layout, routing, colours, focus, groups, search, model. No DOM, no React. |
| `state/` | `DiagramProvider` + `diagram-reducer` + slice contexts |
| `hooks/` | `use-diagram-gestures` — pan/zoom/drag state machine |
| `view/` | `diagram/`, `detail-panel/`, `top-bar/`, `error-banner/`, `modal/`, `eer-viewer/` |
| `adapter/` | `schema-graph-to-model.ts` — `SchemaGraph` → eer `Model` |
| `index.ts` | Public surface: `EerDiagram`, `schemaGraphToModel` |

**Moves to `packages/db/src/schema/drizzle-roundtrip/`:** `describe-drizzle`, `render-sql`, `import-drizzle`, `export-drizzle`, the `pg-types` drift test, the round-trip gate and its fixtures (~19 files).

**Deleted:** `apps/eer` entirely; `apps/web/src/components/schema/erd-engine.ts` + its test + `erd.css`.

---

### Task 1: Move the drizzle round-trip to `packages/db`

Doing this first empties `apps/eer` of everything that is not the diagram, so later deletion is unambiguous.

**Files:**
- Create: `packages/db/src/schema/drizzle-roundtrip/` containing `describe-drizzle.ts`, `render-sql.ts`, `import-drizzle.ts`, `export-drizzle.ts` (+ their `index.ts` barrels and tests), moved from `apps/eer/src/node/` and `apps/eer/src/engine/model/{import,export}-drizzle/`
- Move: `apps/eer/src/test/fixtures/{kitchen-sink-schema.ts,tiny-schema.ts}`, `apps/eer/src/test/gate/roundtrip.gate.test.ts`, `apps/eer/src/test/helpers/load-generated-module.ts`, `apps/eer/src/engine/model/pg-types/pg-types.test.ts`
- Modify: `packages/db/package.json` (scripts), `packages/db/vitest.config.ts` if the gate needs longer timeouts

**Interfaces:**
- Produces: `describeDrizzle(mod, groups)` → `SchemaDescription`; `importDrizzle`, `exportDrizzle`, `renderSql` — same signatures they have today.
- Consumes: `packages/db`'s own `SCHEMA_GROUPS` and schema barrel, replacing the old cross-package relative import in `apps/eer/vite-plugins/drizzle-api.ts`.

- [ ] **Step 1: Move the files with git mv, preserving history**

```bash
cd /c/Users/bbend/Desktop/Projects/tickets/.claude/worktrees/schema-browser
mkdir -p packages/db/src/schema/drizzle-roundtrip
git mv apps/eer/src/node/describe-drizzle packages/db/src/schema/drizzle-roundtrip/describe-drizzle
git mv apps/eer/src/node/render-sql packages/db/src/schema/drizzle-roundtrip/render-sql
git mv apps/eer/src/engine/model/import-drizzle packages/db/src/schema/drizzle-roundtrip/import-drizzle
git mv apps/eer/src/engine/model/export-drizzle packages/db/src/schema/drizzle-roundtrip/export-drizzle
mkdir -p packages/db/src/schema/drizzle-roundtrip/fixtures
git mv apps/eer/src/test/fixtures/kitchen-sink-schema.ts packages/db/src/schema/drizzle-roundtrip/fixtures/
git mv apps/eer/src/test/fixtures/tiny-schema.ts packages/db/src/schema/drizzle-roundtrip/fixtures/
git mv apps/eer/src/test/gate/roundtrip.gate.test.ts packages/db/src/schema/drizzle-roundtrip/
git mv apps/eer/src/test/helpers/load-generated-module.ts packages/db/src/schema/drizzle-roundtrip/
```

- [ ] **Step 2: Repoint imports**

These modules imported eer's `engine/model/types`, `pg-types` and `load-model`. Those still live in `apps/eer` at this point and will move in Task 2, so `import-drizzle`/`export-drizzle` need their model-side dependencies.

**Decision to make and record in your report:** either (a) copy the small `types.ts` + `pg-types/` into `drizzle-roundtrip/` so `packages/db` is self-contained, or (b) have Task 2 land the engine first and import from `apps/web`. **Choose (a)** — `packages/db` must not import from `apps/web`; that would invert the dependency direction and break the build. Copying ~5 files is the correct cost.

Fix every import path so nothing references `apps/eer`. Verify with:

```bash
grep -rn "apps/eer\|\.\./\.\./\.\./apps" packages/db/src | grep -v node_modules
```

Expected: no output.

- [ ] **Step 3: Run the round-trip gate**

Run: `pnpm --filter @tickets/db test -- drizzle-roundtrip`
Expected: PASS. The gate imports the real `@tickets/db` schema, exports it, re-imports the generated file, and asserts `drizzle-kit` generates an EMPTY migration between the two. If it fails, the move broke a path — do not weaken the gate to make it pass.

- [ ] **Step 4: Full db suite and typecheck**

```bash
pnpm --filter @tickets/db test
pnpm --filter @tickets/db typecheck
```
Expected: both clean; test count grows from 406 by the moved tests.

- [ ] **Step 5: Commit**

```bash
git add -A packages/db apps/eer
git commit -m "refactor(db): move the drizzle round-trip out of apps/eer"
```

---

### Task 2: Move the engine

**Files:**
- Move: `apps/eer/src/engine/` → `apps/web/src/components/eer/engine/` (minus `import-drizzle/` and `export-drizzle/`, moved in Task 1, and minus `pg-types/pg-types.test.ts`, also moved)
- Move: `apps/eer/src/ui/color-mix.ts` → `apps/web/src/components/eer/ui/color-mix.ts`

**Interfaces:**
- Produces (consumed by Tasks 3, 4, 6): `loadModel(raw): LoadResult`, `serializeModel(model)`, `applyModelEdit(model, edit)`, `deriveRelationships(model)`, `groupColor`/`entityColor`/`edgeColor`, the geometry/layout/routing/focus/search functions, `mix(color, percent, base?)`, and every type in `engine/model/types/types.ts` (`Model`, `Entity`, `Group`, `Column`, `Constraint`, `TableIndex`, `Relationship`, `EnumDecl`, `LoadResult`, …).

- [ ] **Step 1: Move with git mv**

```bash
mkdir -p apps/web/src/components/eer
git mv apps/eer/src/engine apps/web/src/components/eer/engine
mkdir -p apps/web/src/components/eer/ui
git mv apps/eer/src/ui/color-mix.ts apps/web/src/components/eer/ui/color-mix.ts
```

- [ ] **Step 2: Confirm no dangling imports**

The engine's imports are all relative and internal, except the type-only import of `SchemaDescription` from `../../node/describe-drizzle` inside `import-drizzle` — which left in Task 1.

```bash
grep -rn "from '\.\./\.\./node\|from '\.\./\.\./\.\./node" apps/web/src/components/eer/engine
grep -rn "@bendela6/signals" apps/web/src/components/eer/engine
```
Expected: no output from either. If the first prints anything, a type-only import to the departed node module survived — delete it or inline the type.

- [ ] **Step 3: Run the engine tests — unchanged**

Run: `pnpm --filter @tickets/web test -- components/eer/engine`
Expected: PASS, roughly 45 test files. **Do not edit a single test to make this pass.** These tests assert behaviour, not location; if one fails, the move broke an import path, and the fix belongs in source.

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @tickets/web typecheck`
Expected: clean. If `resolveJsonModule` errors appear, `apps/web/tsconfig.json` needs it — `apps/eer/tsconfig.json` had it set; check and add if a moved file imports JSON.

- [ ] **Step 5: Commit**

```bash
git add -A apps/web apps/eer
git commit -m "refactor(web): move the eer calculation engine into the web app"
```

---

### Task 3: Move state and gestures

**Files:**
- Move: `apps/eer/src/state/` → `apps/web/src/components/eer/state/`
- Move: `apps/eer/src/hooks/use-diagram-gestures/` → `apps/web/src/components/eer/hooks/use-diagram-gestures/`
- Do NOT move: `apps/eer/src/hooks/use-model-loader/` (3 files) — it fetches and reads URL params; the prop replaces it

**Interfaces:**
- Consumes: everything Task 2 produced.
- Produces (consumed by Task 4): `DiagramProvider`, `useDiagramState()`, `useDiagramActions()`, `useDiagramGeometry()` and the other slice hooks from `state/diagram-context.ts`; `useDiagramGestures(...)`.

- [ ] **Step 1: Move**

```bash
git mv apps/eer/src/state apps/web/src/components/eer/state
mkdir -p apps/web/src/components/eer/hooks
git mv apps/eer/src/hooks/use-diagram-gestures apps/web/src/components/eer/hooks/use-diagram-gestures
git rm -r apps/eer/src/hooks/use-model-loader
```

- [ ] **Step 2: Fix engine import paths**

`state/` imported the engine as `../../engine/...`. After the move it is a sibling: `../engine/...`. Update every import in `state/` and `hooks/`, then verify:

```bash
grep -rn "from '\.\./\.\./engine" apps/web/src/components/eer/state apps/web/src/components/eer/hooks
```
Expected: no output.

- [ ] **Step 3: Run state and gesture tests — unchanged**

Run: `pnpm --filter @tickets/web test -- components/eer/state components/eer/hooks`
Expected: PASS (5 test files). Do not edit tests.

- [ ] **Step 4: Typecheck, then commit**

```bash
pnpm --filter @tickets/web typecheck
git add -A apps/web apps/eer
git commit -m "refactor(web): move eer diagram state and gestures into the web app"
```

---

### Task 4: Move the view, trimmed to read-only

This is the task where scope shrinks. Move the view components, then cut every path that led to editing.

**Files:**
- Move: `apps/eer/src/components/{diagram,detail-panel,top-bar,error-banner,modal,eer-viewer}/` → `apps/web/src/components/eer/view/`
- Do NOT move: `apps/eer/src/components/editor/` (36 files), `detail-panel/colors-form.tsx` + its test, `top-bar/model-menu.tsx` + its test
- Modify after moving: `view/eer-viewer/eer-viewer.tsx`, `view/top-bar/top-bar.tsx`, `view/detail-panel/{entity-detail,group-detail,side-panel}.tsx`

**Interfaces:**
- Produces (consumed by Task 8): `EerViewer` — to be renamed `EerDiagram` in Task 7.

- [ ] **Step 1: Move the kept directories**

```bash
mkdir -p apps/web/src/components/eer/view
for d in diagram detail-panel top-bar error-banner modal eer-viewer; do
  git mv apps/eer/src/components/$d apps/web/src/components/eer/view/$d
done
git rm -r apps/eer/src/components/editor
git rm apps/web/src/components/eer/view/detail-panel/colors-form.tsx apps/web/src/components/eer/view/detail-panel/colors-form.test.tsx
git rm apps/web/src/components/eer/view/top-bar/model-menu.tsx apps/web/src/components/eer/view/top-bar/model-menu.test.tsx
```

- [ ] **Step 2: Cut the editor seams**

Find every remaining reference to the departed modules:

```bash
grep -rn "editor-context\|EditorModals\|useEditor\|openModal\|ModelMenu\|ColorsForm\|models-client" apps/web/src/components/eer/view
```

For each hit, remove the affected UI rather than stubbing it:
- `eer-viewer.tsx` — drop the `<EditorModals>` wrapper entirely; the viewer becomes `<DiagramProvider><Viewer/></DiagramProvider>` with no modal host.
- `top-bar.tsx` — remove the `+ Add`, `Import`, `Export` buttons and the `ModelMenu`. **Keep** search, zone/edge filters, the Lines routing-mode toggle, Fit and Rearrange — those are view controls, not editing.
- `entity-detail.tsx` / `group-detail.tsx` — remove the `Edit` button from the header. Keep everything that displays.
- `side-panel.tsx` — remove any editor wiring; keep collapse and resize.

Delete now-unused imports as you go; do not leave dead code.

- [ ] **Step 3: Fix import paths for the new depth**

The view sat at `src/components/<name>/`; it now sits at `src/components/eer/view/<name>/`. Engine/state imports change from `../../engine/...` to `../../engine/...` (unchanged depth by luck) — **verify rather than assume**:

```bash
pnpm --filter @tickets/web typecheck
```
Fix whatever it reports. Expected end state: clean.

- [ ] **Step 4: Run the view tests**

Run: `pnpm --filter @tickets/web test -- components/eer/view`
Expected: the moved tests pass, EXCEPT tests that exercised removed editor affordances. Those tests must be **deleted along with the feature**, not weakened to pass. In your report, list every test you deleted and the removed affordance it covered — a reviewer checks that list against Step 2.

- [ ] **Step 5: Commit**

```bash
git add -A apps/web apps/eer
git commit -m "refactor(web): move the eer view, trimmed to a read-only diagram"
```

---

### Task 5: Retheme — colours

eer's private `@theme` is deleted here, so every colour utility must land on Instrument's scale in the same commit or the diagram renders wrong.

**Files:**
- Modify: every `.tsx`/`.ts` under `apps/web/src/components/eer/` carrying a colour utility (~440 occurrences)
- Modify: `apps/web/src/components/eer/engine/colors/group-color/group-color.ts` (`GROUP_PALETTE`)
- Delete: `apps/eer/src/styles/tailwind.css` is deleted with the app in Task 9; nothing in `apps/web` imports it

**The mapping.** eer's ramp is dark-first (950 = darkest surface, 50 = brightest ink). Instrument's is light-first and **flips with `[data-theme]`**, so this is a semantic remap by ROLE, not a numeric rename:

| eer | Instrument | Role |
|---|---|---|
| `gray-950` | `gray-1` | page surface |
| `gray-900` | `gray-2` | panel surface |
| `gray-800` | `gray-3` | card surface |
| `gray-700` | `gray-4` | raised / hover surface |
| `gray-600` | `gray-6` | border |
| `gray-500` | `gray-7` | strong border |
| `gray-400` | `gray-9` | muted text / icon |
| `gray-300` | `gray-10` | secondary text |
| `gray-200` | `gray-11` | body text |
| `gray-100` | `gray-11` | bright text |
| `gray-50` | `gray-12` | primary ink |
| `<hue>-950` | `<hue>-3` | tinted subtle background |
| `<hue>-700` | `<hue>-11` | tinted text |
| `<hue>-600` | `<hue>-10` | solid hover |
| `<hue>-500` | `<hue>-10` | solid |
| `<hue>-400` | `<hue>-9` | solid anchor |
| `<hue>-300` | `<hue>-11` | tinted text |
| `<hue>-200` | `<hue>-11` | tinted text |
| `violet-*` | `indigo-*` | Instrument has no violet |

- [ ] **Step 1: Apply the mapping**

Work file by file. A blind global replace is NOT acceptable: the table maps the common role for each rung, but a few sites use a rung against the grain (e.g. a `gray-400` border rather than muted text). **After mapping each file, re-read its classes and ask whether foreground/background pairs still have sane contrast** — a border that became `gray-9` where its neighbours are `gray-6` is a mistake the tests cannot see.

Record in your report any site where you deviated from the table and why.

- [ ] **Step 2: Retheme `GROUP_PALETTE`**

The colour engine is pure string passthrough — `groupColor` selects a string by index and `color-mix.ts` interpolates it into `color-mix(in srgb, ${color} …)`. Nothing parses hex, so CSS variables substitute verbatim.

In `engine/colors/group-color/group-color.ts` replace:

```ts
export const GROUP_PALETTE = ['#3987e5', '#199e70', '#c98500', '#9085e9', '#e66767', '#d55181', '#d95926', '#008300'];
```

with Instrument hue tokens, ordered so the first few stay maximally distinct:

```ts
// Instrument option hues at their solid step. Values, not names: these flow
// straight into color-mix() recipes at the element (see ui/color-mix.ts), so
// they must be usable wherever a colour is. `gray` is absent — it reads as
// "no group" rather than a hue.
export const GROUP_PALETTE = [
  'var(--color-blue-9)',
  'var(--color-green-9)',
  'var(--color-orange-9)',
  'var(--color-purple-9)',
  'var(--color-red-9)',
  'var(--color-pink-9)',
  'var(--color-teal-9)',
  'var(--color-cyan-9)',
];
```

- [ ] **Step 3: Confirm the colour tests still pass**

Run: `pnpm --filter @tickets/web test -- components/eer/engine/colors`
Expected: PASS. `group-color.test.ts` asserts inheritance and override precedence, not specific hex values — if it asserted hex, update the expectations to the new strings and say so in your report.

- [ ] **Step 4: Verify no eer-era rung survives**

```bash
grep -rnE "(gray|red|yellow|green|blue|violet)-(50|100|200|300|400|500|600|700|800|900|950)\b" apps/web/src/components/eer --include=*.tsx --include=*.ts | grep -v "\.test\."
```
Expected: **no output.** Any hit is an unmapped site. `violet` appearing at all is a miss — it does not exist in Instrument.

- [ ] **Step 5: Full checks and commit**

```bash
pnpm --filter @tickets/web test -- components/eer
pnpm --filter @tickets/web typecheck
pnpm verify:tokens
git add -A apps/web
git commit -m "refactor(web): retheme the eer diagram onto Instrument colour tokens"
```
`verify:tokens` must be clean. It will now scan these files as part of `apps/web/src`.

---

### Task 6: Retheme — type scale, radius, shadow, retired forms

**Files:** every `.tsx`/`.ts` under `apps/web/src/components/eer/` carrying one of these utilities.

**The mappings:**

| eer | Instrument | Note |
|---|---|---|
| `text-3xs` | `text-9` | 9px — exact |
| `text-2xs` | `text-10` | 10px — exact |
| `text-xs` | `text-11` | 11px — exact |
| `text-sm` | `text-12` | 12px — exact |
| `text-base` | `text-13` | 13px — exact |
| `text-lg` | `text-16` | 16px — exact |
| `shadow-md` | `shadow-raised` | Instrument's shadows are semantic |
| `shadow-lg` | `shadow-overlay` | |
| `shadow-xl` | `shadow-modal` | |
| `rounded-2xl` | `rounded-xl` | `2xl` is retired in Instrument |
| `rounded-t` `rounded-r` `rounded-l` `rounded-br` | `rounded-t-md` etc. | bare `rounded-<side>` is a retired form |

- [ ] **Step 1: Map the type scale**

The px values are identical, so this is a pure rename with no visual change. `engine/geometry/measure-entity` measures text on a canvas at 13/12/11px — those literals must keep matching the classes actually rendered. Verify after mapping:

```bash
grep -rn "13px\|12px\|11px" apps/web/src/components/eer/engine/geometry/measure-entity/measure-entity.ts
```
Confirm the sizes it measures correspond to `text-13`/`text-12`/`text-11` on the card, title and field rows.

- [ ] **Step 2: Map shadows**

Instrument does not define `--shadow-md/lg/xl` **and does not reset the family**, so leaving them silently falls through to Tailwind's generic shadows rather than Instrument's designed ones. That is why these must be remapped rather than left alone.

- [ ] **Step 3: Fix the retired radius forms**

Five sites: one `rounded-2xl` (zone boxes) → `rounded-xl`, and four bare `rounded-<side>` → add an explicit rung (`-md` unless the surrounding element clearly uses another). These will fail `tokens:verify` otherwise.

- [ ] **Step 4: Decide `transition-paint` and record the decision**

`transition-(--transition-paint)` appears at 3 sites (`entity-card.tsx`, `field-row.tsx`, `zone-boxes.tsx`). It resolved to an eer-only `@theme` variable — `opacity, border-color, background-color, box-shadow` — deliberately excluding `transform`/`translate` so drag and pan stay immediate.

That exclusion is load-bearing: a plain `transition-all` would animate transforms and make dragging feel laggy. Replace with an explicit Tailwind utility list that preserves it — `transition-[opacity,border-color,background-color,box-shadow]` is an arbitrary value and therefore **banned**, so use the named utilities `transition-opacity`, `transition-colors` and `transition-shadow` composed together, or add `--transition-paint` to `@tickets/ui`'s tokens if the composition does not cover it. State which you chose and why in your report.

- [ ] **Step 5: Verify no eer-era scale survives**

```bash
grep -rnE "text-(3xs|2xs|xs|sm|base|lg)\b|shadow-(md|lg|xl)\b|rounded-2xl\b" apps/web/src/components/eer --include=*.tsx --include=*.ts | grep -v "\.test\."
```
Expected: no output.

- [ ] **Step 6: Full checks and commit**

```bash
pnpm --filter @tickets/web test -- components/eer
pnpm --filter @tickets/web typecheck
pnpm verify:tokens
git add -A apps/web
git commit -m "refactor(web): move the eer diagram onto Instrument type, radius and shadow scales"
```
`verify:tokens` must be clean — including the radius ratchet, which is what catches a missed bare `rounded-<side>`.

---

### Task 7: The `SchemaGraph` → `Model` adapter

The first task with genuinely new logic, and the one that needs real TDD.

**Files:**
- Create: `apps/web/src/components/eer/adapter/schema-graph-to-model.ts`
- Create: `apps/web/src/components/eer/adapter/schema-graph-to-model.test.ts`
- Create: `apps/web/src/components/eer/index.ts`
- Modify: `apps/web/src/components/eer/view/eer-viewer/eer-viewer.tsx` — rename `EerViewer` → `EerDiagram`, take `model` as a prop

**Interfaces:**
- Consumes: `SchemaGraph`, `TableMeta`, `ColumnMeta`, `GroupMeta`, `EnumMeta`, `qualifiedName` from `apps/web/src/components/schema/erd-types.ts` (the local mirror — do NOT import from `@tickets/db`, the web bundle takes no runtime dependency on it); `loadModel` from `../engine/model/load-model`.
- Produces: `schemaGraphToModel(graph: SchemaGraph): LoadResult`; `<EerDiagram model={Model} />`.

**Design:** build the raw JSON shape `loadModel` already accepts and hand it over, rather than hand-constructing a `Model`. `loadModel` owns normalisation, legacy-shape migration, and — critically — `deriveRelationships`, which turns `fk` constraints into edges. Bypassing it would make the adapter a second source of truth for edge derivation.

**The raw shape, verified against `load-model.ts` rather than assumed:** top-level keys read are `groups` (required, non-empty), `entities` (required, non-empty), `relationships` (optional — leave it out, edges are derived), `enums`, `colors`, `meta`, `view`, `kinds`. An entity takes `id`, `label`, `group`, `schema`, `columns` (legacy alias `fields`), `constraints`. A group takes `id`, `label`, `order`, `parent`. `loadModel` **errors** on empty `groups`/`entities` — Task 8's route guards `tables.length === 0` before rendering, so that path is unreachable in the app.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/components/eer/adapter/schema-graph-to-model.test.ts`:

```tsx
import { describe, expect, it } from 'vitest';
import { schemaGraphToModel } from './schema-graph-to-model';
import type { SchemaGraph } from '../../schema/erd-types';

const graph: SchemaGraph = {
  tables: [
    {
      name: 'projects', schema: 'core', group: 'ws',
      columns: [{ name: 'id', type: 'integer', notNull: true, pk: true, fk: null }],
      primaryKey: ['id'], uniques: [],
    },
    {
      name: 'items', schema: 'records', group: 'rc',
      columns: [
        { name: 'id', type: 'integer', notNull: true, pk: true, fk: null },
        {
          name: 'project_id', type: 'integer', notNull: true, pk: false,
          fk: { schema: 'core', table: 'projects', column: 'id' },
        },
        { name: 'title', type: 'text', notNull: false, pk: false, fk: null },
      ],
      primaryKey: ['id'], uniques: [],
    },
  ],
  groups: [
    { key: 'ws', label: 'Workspace', color: 'blue', tables: ['core.projects'] },
    { key: 'rc', label: 'Records', color: 'orange', tables: ['records.items'] },
  ],
  enums: [{ name: 'status_kind', schema: 'structure', values: ['todo', 'active', 'done'] }],
};

describe('schemaGraphToModel', () => {
  it('produces a loadable model with no errors', () => {
    const { model, errors } = schemaGraphToModel(graph);
    expect(errors).toEqual([]);
    expect(model).not.toBeNull();
  });

  it('keys entities by qualified name so same-named tables stay distinct', () => {
    const { model } = schemaGraphToModel(graph);
    expect(model!.entityById.has('records.items')).toBe(true);
    expect(model!.entityById.has('core.projects')).toBe(true);
  });

  it('carries each table schema onto its entity', () => {
    const { model } = schemaGraphToModel(graph);
    expect(model!.entityById.get('records.items')!.schema).toBe('records');
  });

  it('derives one relationship per foreign key, pointing at the referenced table', () => {
    const { model } = schemaGraphToModel(graph);
    expect(model!.relationships).toHaveLength(1);
    const rel = model!.relationships[0]!;
    expect(rel.source).toBe('records.items');
    expect(rel.sourceField).toBe('project_id');
    expect(rel.target).toBe('core.projects');
    expect(rel.targetField).toBe('id');
  });

  it('marks primary key columns through a pk constraint', () => {
    const { model } = schemaGraphToModel(graph);
    const items = model!.entityById.get('records.items')!;
    const pk = items.constraints.find((c) => c.kind === 'pk');
    expect(pk).toBeDefined();
    expect(pk!.columns).toEqual(['id']);
  });

  it('maps notNull onto nullable, inverted', () => {
    const { model } = schemaGraphToModel(graph);
    const items = model!.entityById.get('records.items')!;
    expect(items.columns.find((c) => c.name === 'id')!.nullable).toBe(false);
    expect(items.columns.find((c) => c.name === 'title')!.nullable).toBe(true);
  });

  it('turns each graph group into a zone carrying its label', () => {
    const { model } = schemaGraphToModel(graph);
    expect(model!.groups.map((g) => g.id).sort()).toEqual(['rc', 'ws']);
    expect(model!.groups.find((g) => g.id === 'rc')!.label).toBe('Records');
  });

  it('assigns every entity to its declared group', () => {
    const { model } = schemaGraphToModel(graph);
    expect(model!.entityById.get('records.items')!.group).toBe('rc');
  });

  it('carries enums through with their values in order', () => {
    const { model } = schemaGraphToModel(graph);
    const e = model!.enums.find((x) => x.name === 'status_kind')!;
    expect(e.values).toEqual(['todo', 'active', 'done']);
    expect(e.schema).toBe('structure');
  });

  // loadModel treats empty groups/entities as a load ERROR ("Missing or empty
  // required key"), so the adapter reports rather than swallows it. The route
  // never gets here — it renders "No tables in this database" when
  // graph.tables is empty — but the adapter must degrade rather than throw if
  // it ever is called that way.
  it('surfaces load errors for an empty graph instead of throwing', () => {
    const result = schemaGraphToModel({ tables: [], groups: [], enums: [] });
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.join(' ')).toContain('entities');
    expect(result.model).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @tickets/web test -- schema-graph-to-model`
Expected: FAIL — cannot find module `./schema-graph-to-model`.

- [ ] **Step 3: Implement**

Create `apps/web/src/components/eer/adapter/schema-graph-to-model.ts`:

```ts
import { qualifiedName, type SchemaGraph } from '../../schema/erd-types';
import { loadModel } from '../engine/model/load-model';
import type { LoadResult } from '../engine/model/types';

/**
 * SchemaGraph (what GET /api/schema returns) -> the eer diagram Model.
 *
 * Builds the RAW json shape `loadModel` already accepts and hands it over,
 * rather than hand-constructing a Model. loadModel owns normalisation, legacy
 * shape migration, and — critically — deriveRelationships, which turns `fk`
 * constraints into edges. Constructing a Model directly would make this file a
 * second source of truth for edge derivation, and the two would drift.
 *
 * Identity is the QUALIFIED name throughout (`schema.table`, bare in public):
 * `terminal.sessions` and `agent.sessions` share a bare name, so a bare key
 * would collapse two independent subsystems into one card.
 */
export function schemaGraphToModel(graph: SchemaGraph): LoadResult {
  const entities = graph.tables.map((t) => {
    const id = qualifiedName(t.schema, t.name);

    const columns = t.columns.map((c) => ({
      name: c.name,
      type: c.type,
      nullable: !c.notNull,
    }));

    // A pk constraint is what draws the PK badge (columnRoles derives badges
    // from constraints, never from a stored flag), and an fk constraint is what
    // draws an edge — deriveRelationships regenerates one edge per resolvable
    // fk. Both must therefore be expressed as constraints, not as column flags.
    const constraints: Record<string, unknown>[] = [];
    if (t.primaryKey.length > 0) {
      constraints.push({ kind: 'pk', name: null, columns: [...t.primaryKey] });
    }
    for (const u of t.uniques) {
      constraints.push({ kind: 'unique', name: u.name, columns: [...u.columns] });
    }
    for (const c of t.columns) {
      if (!c.fk) continue;
      constraints.push({
        kind: 'fk',
        name: null,
        columns: [c.name],
        refSchema: c.fk.schema,
        refTable: c.fk.table,
        refColumns: [c.fk.column],
      });
    }

    return { id, label: t.name, group: t.group, schema: t.schema, columns, constraints };
  });

  const groups = graph.groups.map((g, order) => ({ id: g.key, label: g.label, order }));

  const enums = graph.enums.map((e) => ({
    name: e.name,
    schema: e.schema,
    values: [...e.values],
  }));

  // Colour overrides keyed by group id: the graph's hue NAMES resolve to token
  // values here, at the one boundary that knows both vocabularies. groupColor
  // passes these straight into color-mix() recipes, so a token value works
  // wherever a colour does — and it flips with the theme, which a hex could not.
  const colors: Record<string, string> = {};
  for (const g of graph.groups) colors[g.key] = `var(--color-${g.color}-9)`;

  return loadModel({
    meta: { title: 'Database schema' },
    groups,
    entities,
    enums,
    colors,
  });
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @tickets/web test -- schema-graph-to-model`
Expected: PASS (10 tests). If `loadModel` reports errors, read them — they name exactly which field of the raw shape it rejected. Fix the adapter, never `loadModel`.

- [ ] **Step 5: Prove two assertions are real guards**

Report both experiments:
- Change `id` from `qualifiedName(t.schema, t.name)` to bare `t.name` → the qualified-key test must FAIL.
- Drop the `fk` constraint push → the relationship test must FAIL.

If either leaves the suite green, the test is not a guard yet.

- [ ] **Step 6: Turn the viewer into a controlled component**

In `view/eer-viewer/eer-viewer.tsx`, rename `EerViewer` to `EerDiagram`, accept `{ model }: { model: Model }`, and load it into the reducer on mount and whenever the prop changes:

```tsx
export function EerDiagram({ model }: { model: Model }) {
  return (
    <DiagramProvider>
      <ModelLoader model={model} />
      <Viewer />
    </DiagramProvider>
  );
}
```

where `ModelLoader` is a small component that calls `useDiagramActions().load(model)` in an effect keyed on `model`, then re-packs once webfonts are ready (the old `use-model-loader` did this — measured card widths are wrong before fonts load):

```tsx
function ModelLoader({ model }: { model: Model }) {
  const actions = useDiagramActions();
  useEffect(() => {
    actions.load(model);
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (fonts?.ready) void fonts.ready.then(() => actions.repackAndFit());
  }, [actions, model]);
  return null;
}
```

Create `apps/web/src/components/eer/index.ts`:

```ts
export { EerDiagram } from './view/eer-viewer/eer-viewer';
export { schemaGraphToModel } from './adapter/schema-graph-to-model';
```

- [ ] **Step 7: Checks and commit**

```bash
pnpm --filter @tickets/web test -- components/eer
pnpm --filter @tickets/web typecheck
git add -A apps/web
git commit -m "feat(web): adapt the live SchemaGraph into the eer diagram model"
```

---

### Task 8: Wire it into `/schema` and delete the legacy renderer

**Files:**
- Modify: `apps/web/src/routes/schema-route.tsx`
- Modify: `apps/web/src/components/eer/view/eer-viewer/eer-viewer.tsx` (drop `h-screen`)
- Delete: `apps/web/src/components/schema/erd-engine.ts`, `erd-engine.test.ts`, `erd.css`
- Keep: `apps/web/src/components/schema/erd-types.ts` — the adapter's input types live there

**Interfaces:**
- Consumes: `EerDiagram`, `schemaGraphToModel` (Task 7); `useSchemaGraph` (Phase 1).

- [ ] **Step 1: Fix the viewport coupling**

`eer-viewer.tsx:13` has `flex h-screen flex-col`. Inside `AppShell`'s `<main>` (already `min-h-0 min-w-0 flex-1 overflow-auto`) that produces a double scrollbar and clips the diagram. Change to `flex h-full min-h-0 flex-col` so it fills its container instead of the viewport.

- [ ] **Step 2: Rewrite the route**

Keep the `<AppShell>` wrapper, the `?database=` search param and the empty state — all of which Phase 1 established and which must not regress:

```tsx
function SchemaPage() {
  const { database } = schemaRoute.useSearch();
  const { data, isLoading, error } = useSchemaGraph(database);
  const result = useMemo(() => (data ? schemaGraphToModel(data) : null), [data]);

  return (
    <AppShell>
      {isLoading && <p className="p-6 font-sans text-13 text-gray-11">Loading schema…</p>}
      {error && <p className="p-6 font-sans text-13 text-red-11">Failed to load schema.</p>}
      {result?.errors.length ? (
        <p className="p-6 font-sans text-13 text-red-11">This schema could not be drawn.</p>
      ) : null}
      {data && data.tables.length === 0 && (
        <p className="p-6 font-sans text-13 text-gray-11">No tables in this database.</p>
      )}
      {result?.model && data && data.tables.length > 0 ? <EerDiagram model={result.model} /> : null}
    </AppShell>
  );
}
```

`useMemo` on `data` matters: `schemaGraphToModel` runs `loadModel` plus layout packing, and a new `Model` identity on every render would retrigger `ModelLoader`'s effect in a loop.

- [ ] **Step 3: Delete the legacy renderer**

```bash
git rm apps/web/src/components/schema/erd-engine.ts apps/web/src/components/schema/erd-engine.test.ts apps/web/src/components/schema/erd.css
```

`erd-types.ts` STAYS — the adapter imports `SchemaGraph` and `qualifiedName` from it, and its comment records why web keeps a local mirror instead of importing `@tickets/db`.

- [ ] **Step 4: Update the route tests**

`apps/web/src/routes/schema-route.test.tsx` (from Phase 1's fix wave) mounts the real route on the real `rootRoute` and asserts the rail, the SCHEMA panel and the dropdown render. Those assertions must all still pass — they are the guard against the Critical Phase 1 regression.

Its diagram-specific assertions need updating from the legacy DOM to eer's. **Do not weaken them to "renders something":** assert that a table from the stubbed graph appears as a card. Add one assertion that a fk edge is drawn (eer renders edges as SVG `path` inside the edges layer).

- [ ] **Step 5: Full web suite, typecheck, tokens**

```bash
pnpm --filter @tickets/web test
pnpm --filter @tickets/web typecheck
pnpm verify:tokens
```
Expected: all clean. Test count drops by the deleted `erd-engine.test.ts` cases and rises by eer's.

- [ ] **Step 6: Commit**

```bash
git add -A apps/web
git commit -m "feat(web): render /schema with the eer diagram, delete the legacy ERD"
```

---

### Task 9: Delete `apps/eer` and clean the workspace

**Files:**
- Delete: `apps/eer/` entirely
- Modify: `mprocs.yaml` (drop the `eer` pane), `packages/web/ui/scripts/scan-hardcoded-values.mjs` (drop the `apps/eer` root), `packages/web/ui/src/tokens/vocabulary.ts` (the "deliberately absent" comment)
- Delete: `packages/web/ui/scripts/eer-baseline.json`

- [ ] **Step 1: Confirm nothing still references it**

```bash
grep -rn "@tickets/eer\|apps/eer" --include=*.json --include=*.yaml --include=*.ts --include=*.tsx --include=*.mjs . 2>/dev/null | grep -v node_modules | grep -v pnpm-lock | grep -v docs/
```
Every remaining hit must be one of the files listed above. If anything else appears, resolve it before deleting.

- [ ] **Step 2: Delete the app and its ratchet baseline**

```bash
git rm -r apps/eer
git rm packages/web/ui/scripts/eer-baseline.json
```

- [ ] **Step 3: Drop the eer scanner root**

In `packages/web/ui/scripts/scan-hardcoded-values.mjs` remove the `{ app: 'eer', dir: …, baselined: true }` entry and the `baselineFile` wiring that served it. In `packages/web/ui/src/tokens/vocabulary.ts` update the ROOTS docblock — it currently says `apps/eer` "is deliberately absent — it declares its own `@theme`", which stops being true the moment the app is gone.

**The 71 baselined violations disappear with the app**; they were overwhelmingly its private palette. The two real ones (a dot-grid gradient and `GROUP_PALETTE`) were resolved in Tasks 5 and 6 — if `verify:tokens` now reports a fresh hit inside `components/eer`, fix the class rather than reinstating a baseline.

- [ ] **Step 4: Drop the mprocs pane**

Remove the `eer:` block from `mprocs.yaml`.

- [ ] **Step 5: Reinstall and verify the workspace**

```bash
pnpm install
pnpm typecheck
pnpm build
pnpm verify:tokens
```
Expected: all clean, with `@tickets/eer` gone from the workspace.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: delete apps/eer, now living in the web app"
```

---

### Task 10: Full verification

**Files:** none created; this task proves the phase.

- [ ] **Step 1: Every suite**

```bash
pnpm --filter @tickets/db test
pnpm --filter @tickets/api test
pnpm --filter @tickets/web test
```
Expected: all PASS. db grows by the round-trip tests from Task 1; web grows by eer's ~62.

- [ ] **Step 2: Typecheck, build, tokens**

```bash
pnpm typecheck
pnpm build
pnpm verify:tokens
```
Expected: all clean, with no eer baseline.

- [ ] **Step 3: Drive it in a browser**

Start the stack (see the `running-the-stack` skill), then on `/schema`:

1. The Schema rail item is present and lights when active; the panel shows the database dropdown. **This is the Phase 1 Critical regression — check it first.**
2. Tables render as cards inside labelled, coloured zone boxes.
3. **Edges are visible** — FK relationships draw as lines with crow's-foot markers.
4. **Wheel zooms. Middle-drag pans. Left-drag moves a card, and moves a whole zone by its header.** These are what Phase 1 could not do at all.
5. The Lines control cycles curved → avoid → ortho and the routing visibly changes.
6. Clicking an entity focuses its relationships; hovering a field lights its edges; clicking an edge isolates it; `Esc` clears.
7. Search finds a table and reveals it. Fit and Rearrange work.
8. The detail panel shows the selected table's columns, types and constraints; it collapses and resizes.
9. Switch databases in the dropdown — the diagram redraws for the new database. Try `tickets_legacy`, which has 15 tables the code does not declare, in `ns:public` alongside curated groups.
10. Toggle the theme. **The diagram must follow light/dark** — it was dark-only before this phase.
11. No horizontal page scrollbar; the diagram scrolls within its own container.

- [ ] **Step 4: Confirm the phase's point**

Load `/schema?database=tickets_legacy`, drag a card, zoom out, click a table to focus its relationships. All three were impossible before this phase — the legacy renderer had no gestures and no focus model.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix(web): address verification findings"
```

---

## Self-Review

**Spec coverage.** Every Phase 2 requirement in the spec maps to a task: module location and shape (Tasks 2–4); the public surface `<EerDiagram model>` + `schemaGraphToModel` (Task 7); read-only trimming with `apply-model-edit`/`pg-types` retained as load-bearing (Tasks 2, 4); theme adoption including the colour reversal, 1:1 type scale, `rounded-2xl`, and `GROUP_PALETTE` (Tasks 5–6); round-trip tooling to `packages/db` and the `ssrLoadModule` surface retired with it (Task 1); deletion of `apps/eer`, the legacy renderer, the mprocs pane and the eer baseline (Tasks 8–9); verification (Task 10).

**Beyond the spec, added deliberately:** the `AppShell` constraint and its regression test (a Phase 1 lesson the spec predates), the `transition-paint` decision (Task 6 Step 4), and the shadow remap — the spec did not know Instrument lacks `--shadow-md/lg/xl`.

**Placeholder scan.** None. Every code step carries real code; every verification step names the command and expected result. The two genuinely open decisions — how `packages/db` gets its model types (Task 1 Step 2) and how `transition-paint` is replaced (Task 6 Step 4) — are stated as decisions with a recommended answer and a requirement to record what was chosen, not as "TBD".

**Type consistency.** `schemaGraphToModel` returns `LoadResult` in Task 7's interface block, its implementation, and Task 8's consumption (`result.errors`, `result.model`). `EerDiagram` takes `{ model: Model }` in Tasks 7 and 8 alike. `SchemaGraph`/`TableMeta`/`ColumnMeta`/`GroupMeta`/`EnumMeta` and `qualifiedName` come from `erd-types.ts` throughout — never from `@tickets/db`. `GROUP_PALETTE` stays a `string[]` in Task 5, matching `groupColor`'s existing indexing.

**Risk concentration.** Task 5 is the largest single change (~440 sites) and the one a test suite cannot fully judge — colour contrast is not something `tokens:verify` or vitest can see. Its Step 4 grep proves no eer-era rung *survives*, not that every replacement was the *right* rung. Task 10's browser pass is the only real check on that, which is why it enumerates specific visual expectations rather than "looks right".
