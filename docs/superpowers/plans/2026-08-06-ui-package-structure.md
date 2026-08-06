# @tickets/ui package structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganise `packages/web/ui/src` into three layers and eight role groups, each group built from the same folder vocabulary, without changing a single exported name.

**Architecture:** Bottom-up along the dependency arrow — `style` first, then the eight groups inside `library/`, then `docs/` last so its imports are rewritten once against final paths. Every move is `git mv`; every broken relative import is a type error, so `pnpm --filter @tickets/ui typecheck` is the exhaustive find-the-breakage tool at every step. Only the final task changes behaviour (deriving the gallery group from the directory).

**Tech Stack:** TypeScript 6 / React 19 / Vite 8 / Vitest 4, pnpm + turbo workspace. No path aliases anywhere — `tsconfig.json` has none and `vitest.config.ts` globs `src/**/*.test.{ts,tsx}`, so both are depth-agnostic and need no edits.

Spec: `docs/superpowers/specs/2026-08-06-ui-package-structure-design.md`
Reviewed as an artifact: <https://claude.ai/code/artifact/886ba54d-dd96-425c-89ae-c53c88a9bdd1>

## Global Constraints

- **No exported name changes.** `ControlProps`, `ControlSize`, `Option`, `CONTROL_LADDER`, `disabledClass`, `fieldClass`, `fieldState`, `ComboboxList`, `FieldLabel`, `FieldError`, `FieldWrapper`, `useIsNarrow`, `tableRender`, every `*Column` — all keep their names. This reorg moves files, nothing else.
- **Use `git mv`, never delete-and-recreate.** Rename detection is what keeps the history readable across ~340 moved files.
- **Every task ends green.** `pnpm --filter @tickets/ui typecheck` and `pnpm --filter @tickets/ui test` both pass before you commit. Never commit a red tree "to be fixed in the next task".
- **Exactly three things land outside `packages/web/ui`,** all in Task 11: one test fixture string in `@tickets/playground`, `group:` dropped from four `apps/web` demos, and two lines of `CLAUDE.md`. **No playground source file changes** — that is a design constraint, not luck; see Task 10's "Why the group stays on `meta`". If any other file outside the package needs editing, a symbol stopped being exported — stop and fix the barrel instead.
- **Historical specs and plans under `docs/superpowers/` are never rewritten.** About twenty of them name the old paths; they record what was true when written.
- **`parts/` is exported, not private.** Group barrels re-export everything in `parts/`; `apps/web/src/ui/status-select.tsx` imports `fieldClass`, `fieldState` and `ComboboxList` from `@tickets/ui` and must keep compiling untouched.
- **Deprecated components move like any other.** `copy-button`, `field-label`, `item-key`, `rail-label`, `relative-date`, `section-header`, `session-kind-glyph` go to their role group. They are not quarantined.

## Depth reference

Every import rewrite in this plan is depth arithmetic. `src/` is depth 0. Keep this table open:

| File, after the move | Depth | Reaches `src/style` as | Reaches `src/docs/gallery` as |
| --- | --- | --- | --- |
| `library/<group>/components/<comp>/x.tsx` | 4 | `../../../../style` | `../../../../docs/gallery` |
| `library/inputs/parts/<part>/x.ts` | 4 | `../../../../style` | — |
| `library/inputs/contract.ts` | 2 | `../../style` | — |
| `library/forms/bindings/<k>/<k>-field.tsx` | 4 | `../../../../style` | — |
| `library/forms/registry.ts` | 2 | `../../style` | — |
| `library/table/parts/render-*.tsx` | 3 | `../../../style` | — |
| `library/table/columns/*.tsx` | 3 | `../../../style` | — |
| `library/table/table-render.ts` | 2 | `../../style` | — |
| `style/cn/cn.ts` | 2 | — (`../generated`) | — |
| `docs/pages/spec.ts` | 2 | — | — |
| `docs/pages/colors/colors.ts` | 3 | `../../../style/generated` | — |

Two shorthands used repeatedly below:

**`TYPECHECK-FIX LOOP`** — run `pnpm --filter @tickets/ui typecheck`, open each `TS2307: Cannot find module` it reports, correct that relative path using the table above, repeat until clean. This is the whole import-rewrite procedure; there is no faster honest version, and tsc will not miss one.

**`GREEN GATE`** — both of these pass:
```bash
pnpm --filter @tickets/ui typecheck
pnpm --filter @tickets/ui test
```

---

### Task 1: Move generated token values under `style/`

**Files:**
- Move: `packages/web/ui/src/generated/` → `packages/web/ui/src/style/generated/` (8 files)
- Modify: `packages/web/ui/scripts/generators/utils/paths.ts:48`
- Modify: `packages/web/ui/package.json` (the `tokens:verify` script)
- Modify: `packages/web/ui/src/style/cn/cn.ts:3`, `src/style/cn/cn.test.ts:1`, `src/style/tones/tones.ts:17`

**Interfaces:**
- Consumes: nothing.
- Produces: `src/style/generated/index.ts` exporting `HUES`, `PALETTE`, `TONE_HUE`, `FONT_WEIGHTS`, `TEXT_SIZES`, `RADII` and the rest, unchanged. Later tasks import these only through `src/style/index.ts`.

- [ ] **Step 1: Confirm the current state is green before touching anything**

```bash
cd /c/Users/bbend/Desktop/Projects/tickets
pnpm --filter @tickets/ui typecheck && pnpm --filter @tickets/ui test
```

Expected: both pass. If they do not, stop — you are not starting from a clean base and every later failure will be ambiguous.

- [ ] **Step 2: Move the directory**

```bash
cd packages/web/ui
git mv src/generated src/style/generated
```

- [ ] **Step 3: Point the generator at the new output directory**

In `scripts/generators/utils/paths.ts`, line 48:

```ts
export const GENERATED_TS_DIR = path.join(PACKAGE_ROOT, 'src', 'style', 'generated');
```

Update the doc comment directly above it so it stays true:

```ts
/**
 * Generated TypeScript, one file per family — the `styles/generated/` rule
 * applied to code. Under `src/style/` because that is the only code that reads
 * it: `cn.ts` and `tones.ts` both did so as `../../generated` before the move.
 * The directory is the "do not edit" marker.
 */
```

- [ ] **Step 4: Point the verify gate at the new path**

In `package.json`, the `tokens:verify` script — change the trailing path list only:

```json
"tokens:verify": "node scripts/generators/build-tokens.ts && node scripts/extract-safelist.mjs && git diff --exit-code -- styles/generated src/style/generated"
```

- [ ] **Step 5: Fix the three importers**

`src/style/cn/cn.ts:3` and `src/style/cn/cn.test.ts:1` — `'../../generated'` becomes `'../generated'`.
`src/style/tones/tones.ts:17` — `'../../generated/colors'` becomes `'../generated/colors'`.

- [ ] **Step 6: Run the TYPECHECK-FIX LOOP**

Expected: clean after the three edits above. Any further `TS2307` is another file that reached `src/generated` — fix it the same way.

- [ ] **Step 7: Prove the generator writes where the gate looks**

```bash
pnpm --filter @tickets/ui tokens:build
git status --short packages/web/ui/src
```

Expected: **no output** from `git status`. The generator overwrote the eight files with byte-identical content in their new home. If files appear under `src/generated/`, Step 3 did not take.

- [ ] **Step 8: Run the full gate**

```bash
pnpm --filter @tickets/ui tokens:verify
```

Expected: exits 0. This proves generator output and diff guard agree on the new path.

- [ ] **Step 9: GREEN GATE, then commit**

```bash
git add -A packages/web/ui
git commit -m "refactor(ui): the token values move next to the only code that reads them"
```

---

### Task 2: Rename `components/` to `library/`, and move `forms/` and `table/` inside it

Top-level moves only. No group carving yet — this task's job is to make `library/` exist with everything under it, so later tasks only ever move things *within* `library/`.

**Files:**
- Move: `src/components/` → `src/library/`
- Move: `src/forms/` → `src/library/forms/`
- Move: `src/table/` → `src/library/table/`
- Modify: `src/index.ts`
- Modify: `src/library/index.ts` (was `src/components/index.ts`)

**Interfaces:**
- Consumes: `src/style/` from Task 1.
- Produces: `src/library/index.ts` — the single barrel re-exporting everything the old `components`, `forms` and `table` barrels exported. `src/index.ts` re-exports it as `./library`.

- [ ] **Step 1: Move the three directories**

```bash
cd /c/Users/bbend/Desktop/Projects/tickets/packages/web/ui
git mv src/components src/library
git mv src/forms src/library/forms
git mv src/table src/library/table
```

- [ ] **Step 2: Fold the forms and table barrels into the library barrel**

Append to `src/library/index.ts`:

```ts
export * from './forms';
export * from './table';
```

- [ ] **Step 3: Rewrite the package entry point**

`src/index.ts` — replace the three separate re-exports of components, forms and table with one. The file becomes:

```ts
// The package's single entry point — `@tickets/ui` resolves here and nothing
// else does, apart from the tokens.css stylesheet.
//
// `tokens/` is not re-exported: the JSON is read by path from docs/pages/, and
// pulling ~2500 lines of it through the barrel would be pure cost.
//
// `gallery/demos` and `gallery/demo-sources` ARE re-exported, and they each run
// an eager `import.meta.glob`. That is safe only because this package declares
// `sideEffects: false`, which lets the bundler drop them for the consumers that
// never touch `packageDemos` — every screen except the gallery route. If that
// flag is ever removed, all 18 demo modules and their raw source text land in
// the app's entry chunk.
import './style/css-custom-properties';

export * from './library';
export * from './style';
export * from './foundation';
export * from './gallery';
export * from './gallery/demos';
export * from './gallery/demo-sources';
```

(`foundation` and `gallery` still sit at `src/` — they move in Task 9.)

- [ ] **Step 4: Run the TYPECHECK-FIX LOOP**

This is the largest single batch of import fixes in the plan: every file under `src/library/forms/` and `src/library/table/` gained one level of depth. Expect roughly:
- `forms/**` — `'../components/inputs/...'` becomes `'../inputs/...'` (forms is now a sibling inside library, not a level above it)
- `forms/**` — `'../../style'` becomes `'../../../style'`
- `table/**` — `'../style'` becomes `'../../style'`, `'../../style'` becomes `'../../../style'`
- `table/**` — `'../../components/pill'` becomes `'../pill'`

- [ ] **Step 5: GREEN GATE**

- [ ] **Step 6: Prove the public surface did not shrink**

```bash
cd /c/Users/bbend/Desktop/Projects/tickets
pnpm --filter @tickets/web typecheck
```

Expected: passes with zero changes to `apps/web`. This is the real test of Steps 2–3 — if the barrel dropped a symbol, 125 files find out here.

- [ ] **Step 7: Commit**

```bash
git add -A packages/web/ui
git commit -m "refactor(ui): components becomes library, and forms and table move in beside their peers"
```

---

### Task 3: Carve `library/inputs/` — contract, parts, components

**Files:**
- Rename: `library/inputs/control/control.ts` → `library/inputs/contract.ts`
- Rename: `library/inputs/control/control.test.ts` → `library/inputs/contract.test.ts`
- Move: `library/inputs/control/aria-readonly.test.tsx` → `library/inputs/aria-readonly.test.tsx`
- Delete: `library/inputs/control/index.ts` (the one file this whole reorg removes)
- Move: `field/ toggle/ chip/ popup/ option-row/ combobox-list/` → `library/inputs/parts/`
- Move: the 26 control directories → `library/inputs/components/`
- Create: `library/inputs/parts/index.ts`, `library/inputs/components/index.ts`
- Modify: `library/inputs/index.ts`

**Interfaces:**
- Consumes: `library/index.ts` from Task 2.
- Produces:
  - `library/inputs/contract.ts` — exports `ControlSize`, `ControlProps<T>`, `Option`, `CONTROL_LADDER`, `disabledClass`, unchanged.
  - `library/inputs/parts/index.ts` — re-exports `fieldClass`, `fieldState`, `toggleRowClass`, `Chip`, `Popup`, `popupClass`, `POPUP_OFFSET`, `OptionRow`, `ComboboxList`, `ComboOption`.
  - `library/inputs/components/index.ts` — re-exports all 26 controls.
  - `library/inputs/index.ts` — re-exports contract, parts and components. Same surface as before.

- [ ] **Step 1: Promote the contract**

```bash
cd /c/Users/bbend/Desktop/Projects/tickets/packages/web/ui/src/library/inputs
git mv control/control.ts contract.ts
git mv control/control.test.ts contract.test.ts
git mv control/aria-readonly.test.tsx aria-readonly.test.tsx
git rm control/index.ts
```

`control/` is now empty and git has dropped it.

- [ ] **Step 2: Bin the parts**

```bash
mkdir parts
for p in field toggle chip popup option-row combobox-list; do git mv "$p" "parts/$p"; done
```

- [ ] **Step 3: Bucket the 26 controls**

```bash
mkdir components
for c in checkbox checkbox-group color-picker combobox date-picker date-range-picker \
         duration-input file-input icon-picker input multi-combobox number-input \
         password-input pin-input radio-group range-slider rating search-input \
         segmented-control select slider switch tag-input textarea time-picker \
         user-picker; do git mv "$c" "components/$c"; done
```

- [ ] **Step 4: Verify the group root holds only what it should**

```bash
ls
```

Expected exactly: `aria-readonly.test.tsx  components/  contract.test.ts  contract.ts  index.ts  inputs.demo.tsx  parts/`

- [ ] **Step 5: Write the parts barrel**

`library/inputs/parts/index.ts`:

```ts
// The pieces controls are built from. Exported, not hidden: apps that build
// their own control reach for these — apps/web/src/ui/status-select.tsx uses
// fieldClass, fieldState and ComboboxList. `parts/` says "you are reaching
// under the hood", not "you may not".
export * from './field';
export * from './toggle';
export * from './chip';
export * from './popup';
export * from './option-row';
export * from './combobox-list';
```

- [ ] **Step 6: Write the components barrel**

`library/inputs/components/index.ts`:

```ts
export * from './input';
export * from './textarea';
export * from './password-input';
export * from './search-input';
export * from './number-input';
export * from './pin-input';
export * from './duration-input';
export * from './slider';
export * from './rating';
export * from './range-slider';
export * from './checkbox';
export * from './checkbox-group';
export * from './switch';
export * from './combobox';
export * from './select';
export * from './segmented-control';
export * from './radio-group';
export * from './multi-combobox';
export * from './tag-input';
export * from './file-input';
export * from './date-picker';
export * from './time-picker';
export * from './date-range-picker';
export * from './color-picker';
export * from './icon-picker';
export * from './user-picker';
```

- [ ] **Step 7: Rewrite the group barrel**

`library/inputs/index.ts` becomes:

```ts
// The form controls: one contract, one size ladder, one tone system.
//
// `contract` is what every control answers to and what forms/ binds against.
// `parts` are the pieces they are assembled from — a bordered shell, a label
// row, a popup, a list. Neither is a control you would reach for by name, which
// is why neither sits among them.
export * from './contract';
export * from './parts';
export * from './components';
```

- [ ] **Step 8: Run the TYPECHECK-FIX LOOP**

The three rewrites you will make hundreds of times here:
- inside `components/<ctrl>/` — `'../control'` becomes `'../../contract'`, `'../field'` becomes `'../../parts/field'`, `'../../../style'` becomes `'../../../../style'`, `'../../gallery'` becomes `'../../../../gallery'`
- inside `parts/<part>/` — `'../control'` becomes `'../../contract'`, and `'../../../style'` becomes `'../../../../style'`. `popup/popup.tsx` imports Popover, which is still at `library/popover/` until Task 5, so its `'../../popover'` becomes `'../../../popover'` — one more level, same destination. Task 5 moves it again.
- inside `library/forms/bindings`-to-be (still `library/forms/inputs/`) — `'../../../inputs/control'` becomes `'../../../inputs/contract'`

- [ ] **Step 9: GREEN GATE, then confirm the app still compiles**

```bash
cd /c/Users/bbend/Desktop/Projects/tickets
pnpm --filter @tickets/web typecheck
```

Expected: passes untouched. `status-select.tsx` importing `fieldClass`/`fieldState`/`ComboboxList`/`Option`/`ControlSize` is the assertion that Steps 5–7 kept the surface whole.

- [ ] **Step 10: Commit**

```bash
git add -A packages/web/ui
git commit -m "refactor(ui): inputs gets a contract at the door and a parts bin, so the 26 controls stand alone"
```

---

### Task 4: Create `library/primitives/`

Merges the old `actions` and `display` intents into one group of eleven leaf-level components. `menu` and `dropdown` are deliberately **not** here — they move to `overlays/` in Task 5. `table` is not here either — it becomes its own group in Task 8.

**Files:**
- Create: `library/primitives/components/`, `library/primitives/components/index.ts`, `library/primitives/index.ts`
- Move: `avatar button copy-button dot icon item-key pill prose relative-date session-kind-glyph status-dot` → `library/primitives/components/`

**Interfaces:**
- Consumes: `library/index.ts`.
- Produces: `library/primitives/index.ts`, re-exporting `Avatar`, `Button`, `CopyButton`, `Dot`, `Icon`, `ICON_REGISTRY`, `ItemKey`, `Pill`, `Prose`, `RelativeDate`, `SessionKindGlyph`, `StatusDot` and their prop types.

- [ ] **Step 1: Move the eleven**

```bash
cd /c/Users/bbend/Desktop/Projects/tickets/packages/web/ui/src/library
mkdir -p primitives/components
for c in avatar button copy-button dot icon item-key pill prose relative-date \
         session-kind-glyph status-dot; do git mv "$c" "primitives/components/$c"; done
```

- [ ] **Step 2: Write the components barrel**

`library/primitives/components/index.ts`:

```ts
export * from './avatar';
export * from './button';
export * from './copy-button';
export * from './dot';
export * from './icon';
export * from './item-key';
export * from './pill';
export * from './prose';
export * from './relative-date';
export * from './session-kind-glyph';
export * from './status-dot';
```

- [ ] **Step 3: Write the group barrel**

`library/primitives/index.ts`:

```ts
// Leaf level: renders in flow, opens nothing, arranges nothing. A component
// that portals a surface belongs in overlays/; one that positions its children
// belongs in layout/.
export * from './components';
```

- [ ] **Step 4: Run the TYPECHECK-FIX LOOP**

Inside `primitives/components/<comp>/`: `'../../style'` becomes `'../../../../style'`, `'../../gallery'` becomes `'../../../../gallery'`, `'../pill'` becomes `'./pill'` no longer applies — cross-references between these eleven become `'../<other>'` (they are siblings inside the bucket).

Outside: everything that imported `'../avatar'`, `'../button'`, `'../icon'`, `'../pill'`, `'../relative-date'` from elsewhere in `library/` now needs `'../primitives/components/<name>'`. `library/table/**` is the heaviest caller.

- [ ] **Step 5: Fix the domain-free guard's skip paths**

`library/domain-free.test.ts` — two path prefixes, at lines 53 and 56:

```ts
      if (rel.startsWith('primitives/components/icon/registry')) continue;
      // SessionKindGlyph is a known leak, already deprecated and on its way to
      // apps/web. Listed rather than silently skipped.
      if (rel.startsWith('primitives/components/session-kind-glyph/')) continue;
```

- [ ] **Step 6: Prove the guard still guards**

```bash
cd /c/Users/bbend/Desktop/Projects/tickets
pnpm --filter @tickets/ui test -- domain-free
```

Expected: PASS. Then deliberately break it to prove it is still wired: temporarily add `const k = 'epic';` to `library/primitives/components/pill/pill.tsx`, re-run, expect FAIL naming `primitives/components/pill/pill.tsx`, then remove the line and re-run to green. A skip-prefix typo makes this test pass vacuously, which is exactly what this step catches.

- [ ] **Step 7: GREEN GATE, then commit**

```bash
git add -A packages/web/ui
git commit -m "refactor(ui): eleven leaf components become primitives, and the domain guard follows them"
```

---

### Task 5: Create `library/overlays/`, and reclassify menu and dropdown

**Files:**
- Create: `library/overlays/components/`, `library/overlays/parts/`, two barrels, group barrel
- Move: `dialog dialog-footer drawer popover side-panel tooltip menu dropdown` → `library/overlays/components/`
- Move: `library/panel/` → `library/overlays/parts/panel/`

**Interfaces:**
- Consumes: `library/index.ts`.
- Produces: `library/overlays/index.ts`, re-exporting `Dialog*`, `DialogFooter`, `Drawer`, `Dropdown`, `Menu`, `MenuTrigger`, `MenuContent`, `MenuItem`, `Popover`, `PopoverTrigger`, `PopoverContent`, `SidePanel`, `Tooltip`, plus `useIsNarrow`, `usePanelWidth`, `usePersistedFlag`, `useViewportUnder`, `PanelSide` from `parts/panel`.

- [ ] **Step 1: Move the eight components and the panel hooks**

```bash
cd /c/Users/bbend/Desktop/Projects/tickets/packages/web/ui/src/library
mkdir -p overlays/components overlays/parts
for c in dialog dialog-footer drawer popover side-panel tooltip menu dropdown; do
  git mv "$c" "overlays/components/$c"
done
git mv panel overlays/parts/panel
```

- [ ] **Step 2: Write the parts barrel**

`library/overlays/parts/index.ts`:

```ts
// Drawer and SidePanel are the only callers. Exported anyway — an app that
// builds its own resizable panel needs the same width and persistence hooks,
// and useIsNarrow is already used directly by apps/web's shell.
export * from './panel';
```

- [ ] **Step 3: Write the components barrel**

`library/overlays/components/index.ts`:

```ts
export * from './dialog';
export * from './dialog-footer';
export * from './drawer';
export * from './dropdown';
export * from './menu';
export * from './popover';
export * from './side-panel';
export * from './tooltip';
```

- [ ] **Step 4: Write the group barrel**

`library/overlays/index.ts`:

```ts
// Surfaces that open above the page.
//
// Menu and Dropdown are here rather than among the things you press: Menu is a
// portalled radix DropdownMenu, and Dropdown is built directly on this group's
// own Popover. What they have in common with Dialog is the portal, not the
// trigger.
export * from './parts';
export * from './components';
```

- [ ] **Step 5: Run the TYPECHECK-FIX LOOP**

Notable: `library/inputs/parts/popup/popup.tsx` imported `'../../../popover'` after Task 3 — it now becomes `'../../../overlays/components/popover'`. `drawer` and `side-panel` imported `'../panel'`; they now need `'../../parts/panel'`.

- [ ] **Step 6: GREEN GATE, then commit**

```bash
git add -A packages/web/ui
git commit -m "refactor(ui): a portal is not a press — menu and dropdown join the overlays"
```

---

### Task 6: Create `library/layout/`, `library/navigation/` and `library/feedback/`

Three small groups, one task — none of them has parts or a contract, so there is nothing to review independently.

**Files:**
- Move: `card row stack rail-label section-header` → `library/layout/components/`
- Move: `tabs tree` → `library/navigation/components/`
- Move: `progress screen-state spinner toast` → `library/feedback/components/`
- Create: six barrels (a `components/index.ts` and an `index.ts` per group)

**Interfaces:**
- Consumes: `library/index.ts`.
- Produces: `library/layout/index.ts` (`Card`, `Row`, `Stack`, `RailLabel`, `SectionHeader`), `library/navigation/index.ts` (`Tabs`, `Tree`, `useTreeView`), `library/feedback/index.ts` (`Progress`, `ScreenState`, `Spinner`, `Toast`, `ToastProvider`, `useToast`).

- [ ] **Step 1: Move all eleven**

```bash
cd /c/Users/bbend/Desktop/Projects/tickets/packages/web/ui/src/library
mkdir -p layout/components navigation/components feedback/components
for c in card row stack rail-label section-header; do git mv "$c" "layout/components/$c"; done
for c in tabs tree;                                do git mv "$c" "navigation/components/$c"; done
for c in progress screen-state spinner toast;      do git mv "$c" "feedback/components/$c"; done
```

- [ ] **Step 2: Write the three components barrels**

`library/layout/components/index.ts`:

```ts
export * from './card';
export * from './row';
export * from './stack';
export * from './rail-label';
export * from './section-header';
```

`library/navigation/components/index.ts`:

```ts
export * from './tabs';
export * from './tree';
```

`library/feedback/components/index.ts`:

```ts
export * from './progress';
export * from './screen-state';
export * from './spinner';
export * from './toast';
```

- [ ] **Step 3: Write the three group barrels**

`library/layout/index.ts`:

```ts
// Components whose job is arranging other components.
export * from './components';
```

`library/navigation/index.ts`:

```ts
// Moving between places.
export * from './components';
```

`library/feedback/index.ts`:

```ts
// The system telling you something: progress, waiting, the empty screen, the
// transient message.
export * from './components';
```

- [ ] **Step 4: Run the TYPECHECK-FIX LOOP**

`library/forms/field-wrapper.tsx` imports Stack. Task 2 left that as `'../stack'` (Stack sat at `library/stack/`); it now becomes `'../layout/components/stack'`.

`src/foundation/view.tsx` — still at `src/foundation/` until Task 9 — imports `SectionHeader` and `Pill`. Those become `'../library/layout/components/section-header'` and `'../library/primitives/components/pill'`.

- [ ] **Step 5: GREEN GATE, then commit**

```bash
git add -A packages/web/ui
git commit -m "refactor(ui): layout, navigation and feedback take their three shapes"
```

---

### Task 7: Shape `library/forms/`

**Files:**
- Move: `library/forms/inputs/` → `library/forms/bindings/`
- Create: `library/forms/components/field-label/`, `field-error/`, `field-wrapper/`
- Move: `library/primitives/components/field-label/` → `library/forms/components/field-label/`
- Move: `library/primitives/components/field-error/` → `library/forms/components/field-error/`
- Move: `library/forms/field-wrapper.tsx` + `.test.tsx` → `library/forms/components/field-wrapper/`
- Create: `library/forms/components/field-wrapper/index.ts`, `library/forms/components/index.ts`, `library/forms/bindings/index.ts`
- Modify: `library/forms/index.ts`

**Note:** `field-label` and `field-error` were swept into `primitives/components/` by Task 4's glob only if you listed them — Task 4 does **not** list them, so they are still at `library/field-label/` and `library/field-error/`. Move them from there.

**Interfaces:**
- Consumes: `library/inputs/contract.ts` (the six bindings that import `Option`).
- Produces: `library/forms/index.ts` — `FieldLabel`, `FieldError`, `FieldWrapper`, `RootWrapper`, `baseInputs`, `CardLayout`, `ColumnLayout`, `GroupLayout`, `RowLayout` and the 25 `*Field` components, all under their existing names.

- [ ] **Step 1: Rename the adapters folder and gather the field row**

```bash
cd /c/Users/bbend/Desktop/Projects/tickets/packages/web/ui/src/library
git mv forms/inputs forms/bindings
mkdir -p forms/components/field-wrapper
git mv field-label forms/components/field-label
git mv field-error  forms/components/field-error
git mv forms/field-wrapper.tsx      forms/components/field-wrapper/field-wrapper.tsx
git mv forms/field-wrapper.test.tsx forms/components/field-wrapper/field-wrapper.test.tsx
```

- [ ] **Step 2: Give field-wrapper the barrel it never had**

`library/forms/components/field-wrapper/index.ts`:

```ts
export * from './field-wrapper';
```

- [ ] **Step 3: Write the components barrel**

`library/forms/components/index.ts`:

```ts
// The labelled row, in the order it renders: caption, control, message.
// FieldWrapper is what the form engine puts in its `field` slot; the other two
// are for screens that lay out a field by hand, which apps/web does in 11
// dialogs.
export * from './field-label';
export * from './field-error';
export * from './field-wrapper';
```

- [ ] **Step 4: Write the bindings barrel**

`library/forms/bindings/index.ts` — **exactly the seven `forms/index.ts` exports today, no more and no fewer.**

```ts
// The seven this package has always exported by name. The other eighteen
// adapters reach consumers the way all twenty-five actually get used: through
// `baseInputs`, which apps/web spreads and extends with its own `directory`
// kind. Nothing anywhere imports a *Field by name from @tickets/ui — verified
// across all 177 import sites — so widening this barrel would add symbols with
// no caller, and narrowing it would remove symbols with no caller. Either is a
// deliberate change to make on its own, not inside a 340-file move.
export * from './text/text-field';
export * from './textarea/textarea-field';
export * from './number/number-field';
export * from './select/select-field';
export * from './multi-select/multi-select-field';
export * from './toggle/toggle-field';
export * from './json/json-field';
```

**Do not add the other eighteen.** The public API must be byte-identical before and after this reorg — that is what makes Task 11's "nothing changed outside the package" check a real gate. A dropped export cannot hide behind an added one.

- [ ] **Step 5: Rewrite the group barrel**

`library/forms/index.ts`:

```ts
// Fields and forms: the labelled row, one adapter per control, and the
// registry the @tickets/form engine consumes.
export * from './components';
export * from './bindings';
export * from './root-wrapper';
export * from './layouts';
export * from './registry';
```

- [ ] **Step 6: Run the TYPECHECK-FIX LOOP**

`forms/registry.ts` imports every adapter as `'./inputs/<k>/<k>-field'` — all 25 become `'./bindings/<k>/<k>-field'`. Each binding's `'../../../inputs/contract'` stays correct (depth is unchanged by the rename). `field-wrapper.tsx` gained two levels: `'../components/field-error'` becomes `'../field-error'`, and `'../components/stack'` becomes `'../../../layout/components/stack'`.

- [ ] **Step 7: GREEN GATE, then confirm the 11 app call sites still resolve**

```bash
cd /c/Users/bbend/Desktop/Projects/tickets
pnpm --filter @tickets/web typecheck
```

Expected: passes untouched. `FieldLabel` and `FieldError` are imported from `@tickets/ui` in 11 `apps/web` files; this is the assertion that moving them across groups changed nothing observable.

- [ ] **Step 8: Commit**

```bash
git add -A packages/web/ui
git commit -m "refactor(ui): the label, the control and the message finally share a folder"
```

---

### Task 8: Shape `library/table/`

**Files:**
- Create: `library/table/parts/`, move the 12 `render-*.tsx` and `metrics.ts` into it
- Create: `library/table/parts/index.ts`, `library/table/columns/index.ts`
- Modify: `library/table/index.ts`

**Interfaces:**
- Consumes: `library/primitives/components/` (columns render `Avatar`, `Button`, `Icon`, `Pill`, `RelativeDate`).
- Produces: `library/table/index.ts` — `tableRender`, `rowHeightFor`, `CELL_FOCUS_RING`, `Density`, and `TextColumn`, `NumberColumn`, `DateColumn`, `LinkColumn`, `BadgeColumn`, `ImageColumn`, `ActionsColumn`. Identical to today's exports.

- [ ] **Step 1: Bin the render slots**

```bash
cd /c/Users/bbend/Desktop/Projects/tickets/packages/web/ui/src/library/table
mkdir parts
git mv metrics.ts parts/metrics.ts
for f in render-root render-thead render-th render-tbody render-tr render-td \
         render-tfoot render-group-header render-select-cell render-skeleton-row \
         render-empty render-error; do git mv "$f.tsx" "parts/$f.tsx"; done
```

- [ ] **Step 2: Verify the group root**

```bash
ls
```

Expected exactly: `columns/  index.ts  parts/  table-a11y.test.tsx  table-render.test.tsx  table-render.ts  table.demo.tsx`

- [ ] **Step 3: Write the parts barrel**

`library/table/parts/index.ts`:

```ts
// The twelve render slots `tableRender` assembles, and the metrics they all
// lay out on. One shared gridTemplateColumns runs through header, body row and
// skeleton — which is why the padding lives in one file and not three.
export * from './metrics';
export * from './render-root';
export * from './render-thead';
export * from './render-th';
export * from './render-tbody';
export * from './render-tr';
export * from './render-td';
export * from './render-tfoot';
export * from './render-group-header';
export * from './render-select-cell';
export * from './render-skeleton-row';
export * from './render-empty';
export * from './render-error';
```

- [ ] **Step 4: Write the columns barrel**

`library/table/columns/index.ts`:

```ts
// Cell-content helpers. Each returns a Renderer, so they are factories called
// at column-definition time — `TextColumn({ mono: true })` — not components.
export * from './text-column';
export * from './number-column';
export * from './date-column';
export * from './link-column';
export * from './badge-column';
export * from './image-column';
export * from './actions-column';
```

- [ ] **Step 5: Rewrite the group barrel**

`library/table/index.ts`:

```ts
// The engine is @tickets/table. This subtree is the styled adapter: the default
// `tableRender` plus the cell-content helpers in `columns/`.
//
// There is no <Table> component here, which is why this group has `columns/`
// where every other group has `components/`. What you reach for is a factory,
// called as `render={tableRender<Row>()}`.
export { tableRender } from './table-render';
export { rowHeightFor, CELL_FOCUS_RING, type Density } from './parts/metrics';
export * from './columns';
```

- [ ] **Step 6: Run the TYPECHECK-FIX LOOP**

`table-render.ts` imports each slot as `'./render-*'` — all twelve become `'./parts/render-*'`, and `'./metrics'` becomes `'./parts/metrics'`. Inside `parts/`, `'../style'` becomes `'../../../style'` and `'../../primitives/components/pill'` becomes `'../../primitives/components/pill'` (unchanged — `parts/` is one deeper than `table/`, so recheck each against the depth table).

- [ ] **Step 7: GREEN GATE**

Then confirm the app's one call site is untouched:

```bash
cd /c/Users/bbend/Desktop/Projects/tickets
rg "tableRender" apps/web/src --type ts --type tsx
```

Expected: `all-items-screen.tsx` imports it from `@tickets/ui` and calls `tableRender<Row>()`. No edit needed.

- [ ] **Step 8: Commit**

```bash
git add -A packages/web/ui
git commit -m "refactor(ui): table is an adapter, so it keeps columns where the others keep components"
```

---

### Task 9: Create `docs/`

Last of the moves, so every import it rewrites points at final paths.

**Files:**
- Move: `src/gallery/` → `src/docs/gallery/`
- Move: `src/foundation/` → `src/docs/pages/`
- Create: `src/docs/index.ts`
- Modify: `src/index.ts`
- Modify: `src/docs/pages/spec.ts` (six `?raw` imports)

**Interfaces:**
- Consumes: `library/` (the pages render `Pill` and `SectionHeader`).
- Produces: `src/docs/index.ts`, re-exporting the gallery machinery (`collectDemos`, `prepareDemos`, `rebaseGlobKeys`, `sortDemos`, `kebab`, `definePlayground`, `defineState`, `Matrix`, `Slot`, `select`, `boolean`, `text`, `number`, `UI_SRC_ROOT`, `WEB_SRC_ROOT`, `packageDemos`, `packageDemoSources`, `packageComponentSources`, and the `DemoMeta` / `CollectedDemo` / `AnyPlayground` types) plus the foundation pages' `useTheme`, `Theme`, token-reading helpers and contrast maths.

- [ ] **Step 1: Move both directories**

```bash
cd /c/Users/bbend/Desktop/Projects/tickets/packages/web/ui/src
mkdir docs
git mv gallery docs/gallery
git mv foundation docs/pages
```

- [ ] **Step 2: Write the docs barrel**

`src/docs/index.ts`:

```ts
// How the library documents itself: the machinery that collects demos, and the
// pages that show what the token layer actually ships.
//
// Nothing in library/ or style/ imports this. The one exception is deliberate:
// *.demo.tsx files sit beside their component and import definePlayground from
// here, because a demo IS documentation that happens to live next to its
// subject.
export * from './gallery';
export * from './gallery/demos';
export * from './gallery/demo-sources';
export * from './pages';
```

- [ ] **Step 3: Rewrite the package entry point**

`src/index.ts` — the export block becomes exactly three lines:

```ts
export * from './style';
export * from './library';
export * from './docs';
```

Keep the file's existing header comment about `sideEffects: false` and the eager globs, and the `import './style/css-custom-properties';` line above the exports.

- [ ] **Step 4: Fix the stylesheet reads**

`src/docs/pages/spec.ts` — all six `?raw` imports gain one level:

```ts
import colorsCss from '../../../styles/generated/colors.css?raw';
import shadowsCss from '../../../styles/generated/shadows.css?raw';
import typographyCss from '../../../styles/generated/typography.css?raw';
import borderCss from '../../../styles/generated/border.css?raw';
import motionCss from '../../../styles/generated/motion.css?raw';
import breakpointsCss from '../../../styles/generated/breakpoints.css?raw';
```

- [ ] **Step 5: Run the TYPECHECK-FIX LOOP**

Two families dominate:
- All 64 demo files: `'../../gallery'` (or whatever depth they reached) becomes the path to `docs/gallery` — for a component demo at `library/<group>/components/<comp>/`, that is `'../../../../docs/gallery'`.
- `docs/pages/colors/colors.ts` — `'../../generated'` becomes `'../../../style/generated'`. `docs/pages/view.tsx` — `'../components/pill'` becomes `'../../library/primitives/components/pill'`, `'../components/section-header'` becomes `'../../library/layout/components/section-header'`.

- [ ] **Step 6: Verify the glob still finds every demo**

`docs/gallery/demos.ts` globs `'../**/*.demo.tsx'` relative to itself, which now resolves from `src/docs/gallery/` — one level shallower in its reach than before. Change both globs in `demos.ts` and `demo-sources.ts` from `'../**/*.demo.tsx'` to `'../../**/*.demo.tsx'` so they still cover all of `src/`.

Then confirm the count:

```bash
cd /c/Users/bbend/Desktop/Projects/tickets
pnpm --filter @tickets/ui test -- demos.smoke
```

Expected: PASS. This test walks every collected demo; if the glob narrowed, it collects fewer and the assertions on known demos fail.

- [ ] **Step 7: GREEN GATE, then the full workspace**

```bash
pnpm typecheck
```

Expected: every package passes. `@tickets/playground` imports 31 files' worth of gallery types through `@tickets/ui`; this is where a dropped re-export in Step 2 surfaces.

- [ ] **Step 8: Commit**

```bash
git add -A packages/web/ui
git commit -m "refactor(ui): the gallery and the foundation pages are documentation, and now say so"
```

---

### Task 10: Derive the gallery group from the directory

The only behaviour change in the plan. TDD: the derivation function gets tests before it exists.

**Files:**
- Modify: `src/docs/gallery/types.ts`
- Modify: `src/docs/gallery/collect-demos.ts`
- Modify: `src/docs/gallery/collect-demos.test.ts`

**Interfaces:**
- Consumes: `CollectedDemo`, `DemoMeta` from `types.ts`.
- Produces: `groupFromPath(path: string): string | null` exported from `collect-demos.ts` — returns the title-cased group for a library path, `'App'` for an `apps/web/src` path, and `null` for anything else. `DemoMeta` (the **authored** shape) loses `group: string` and gains `deprecated?: boolean`. A new `CollectedMeta = DemoMeta & { group: string }` becomes the type of `CollectedDemo.meta`.

**Why the group stays on `meta`.** `@tickets/playground` reads `d.meta.group` in shipped code — `sidebar.tsx` lines 24, 28 and 88; `command-palette.tsx` lines 55 and 77 — plus eight test fixtures that build `meta: { title, group }` literals. Deriving the group *into* `meta` keeps every one of those working untouched. Moving it to `d.group` would buy nothing and cost thirteen playground files.

- [ ] **Step 1: Write the failing tests**

Add to `src/docs/gallery/collect-demos.test.ts`:

```ts
import { groupFromPath } from './collect-demos';

describe('groupFromPath', () => {
  it('reads the group out of a library path', () => {
    expect(groupFromPath('packages/web/ui/src/library/primitives/components/pill/pill.demo.tsx'))
      .toBe('Primitives');
    expect(groupFromPath('packages/web/ui/src/library/inputs/components/select/select.demo.tsx'))
      .toBe('Inputs');
  });

  it('reads a group whose demo sits at the group root, not under components/', () => {
    expect(groupFromPath('packages/web/ui/src/library/inputs/inputs.demo.tsx')).toBe('Inputs');
    expect(groupFromPath('packages/web/ui/src/library/table/table.demo.tsx')).toBe('Table');
  });

  it('calls the app its own group', () => {
    expect(groupFromPath('apps/web/src/components/ai/message-stream.demo.tsx')).toBe('App');
  });

  it('refuses to guess', () => {
    expect(groupFromPath('packages/web/ui/src/style/cn/cn.demo.tsx')).toBeNull();
    expect(groupFromPath('somewhere/else/x.demo.tsx')).toBeNull();
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

```bash
cd /c/Users/bbend/Desktop/Projects/tickets
pnpm --filter @tickets/ui test -- collect-demos
```

Expected: FAIL — `groupFromPath` is not exported from `./collect-demos`.

- [ ] **Step 3: Implement the derivation**

In `src/docs/gallery/collect-demos.ts`, above `validate`:

```ts
/**
 * Which group a demo belongs to, read off its path.
 *
 * The group used to be hand-typed in `meta.group`, which let the sidebar
 * disagree with the tree — and produced an `Ungrouped` bucket holding seven
 * demos that simply never got a category. The directory is now the only source
 * of truth, so a demo cannot be filed wrong without being *moved* wrong.
 *
 * Both maps arrive rebased onto workspace-relative roots (see rebaseGlobKeys),
 * which is what lets one function serve the package's demos and the app's.
 *
 * Returns null rather than a fallback group: a silent default is exactly how
 * `Ungrouped` grew, so an unrecognised path becomes a visible error card.
 */
export function groupFromPath(path: string): string | null {
  const lib = path.match(/(?:^|\/)packages\/web\/ui\/src\/library\/([^/]+)\//);
  if (lib) return lib[1].replace(/(^|-)(\w)/g, (_, sep, c) => (sep ? ' ' : '') + c.toUpperCase());
  if (/(?:^|\/)apps\/web\/src\//.test(path)) return 'App';
  return null;
}
```

- [ ] **Step 4: Run the tests and watch them pass**

```bash
pnpm --filter @tickets/ui test -- collect-demos
```

Expected: PASS.

- [ ] **Step 5: Commit the derivation before wiring it**

```bash
git add packages/web/ui/src/docs/gallery/collect-demos.ts packages/web/ui/src/docs/gallery/collect-demos.test.ts
git commit -m "feat(ui): a demo's group is where it lives, and an unknown path says so"
```

- [ ] **Step 6: Split the authored meta from the collected meta**

In `src/docs/gallery/types.ts` — `DemoMeta` is what a demo file writes, so it
loses `group` and gains the flag:

```ts
/**
 * What a demo file authors.
 *
 * No `group`: the directory decides that, and a hand-typed one could disagree
 * with where the file actually lives — which is how seven demos ended up in an
 * `Ungrouped` bucket. `collectDemos` derives it and hands back `CollectedMeta`.
 */
export interface DemoMeta {
  title: string;
  order?: number;
  /** Badged in the sidebar and sorted last within its group. The directory
   *  still decides the role; this only decides whether to warn. */
  deprecated?: boolean;
  /** Container width for this demo's state cells. Defaults to 'md'. */
  size?: DemoSize;
  /**
   * The component file(s) behind this demo, shown in the Implementation tab.
   * Paths are relative to the demo file. Defaults to the demo's own path with
   * `.demo` dropped (`pill.demo.tsx` -> `pill.tsx`).
   */
  impl?: string | string[];
}

/**
 * What `collectDemos` hands back: the authored fields plus the derived group.
 *
 * The group lives here rather than beside `meta` because every reader already
 * looks for it here — @tickets/playground's sidebar and command palette both
 * group by `d.meta.group` in shipped code. Deriving INTO meta changes who
 * writes the field without touching anyone who reads it.
 */
export type CollectedMeta = DemoMeta & { group: string };
```

In the success arm of `CollectedDemo`, change `meta: DemoMeta` to `meta: CollectedMeta`.

- [ ] **Step 7: Wire derivation into collection**

In `validate`, replace the group requirement:

```ts
  if (!m.meta || typeof m.meta.title !== 'string') {
    return { ok: false, error: 'missing meta { title }' };
  }
  if ('group' in m.meta) {
    return { ok: false, error: 'meta.group is derived from the directory — delete it' };
  }
```

In `collectDemos`, derive per demo and error on an unknown path:

```ts
    const group = groupFromPath(path);
    if (group === null) {
      return { path, error: 'no group for this path — demos live under library/<group>/ or apps/web/src/' };
    }
    const slug = kebab(v.demo.meta.title);
    return {
      path,
      slug,
      meta: { ...v.demo.meta, group },
      states: (v.demo.states ?? []).map((s) => collectState(s, slug)),
      playground: v.demo.playground,
    };
```

`compare` already reads `a.meta.group` / `b.meta.group` and needs no change there. Replace only the group ranking:

```ts
const GROUP_ORDER = [
  'Primitives', 'Inputs', 'Forms', 'Table',
  'Layout', 'Navigation', 'Overlays', 'Feedback', 'App',
];

function groupRank(group: string): number {
  const explicit = GROUP_ORDER.indexOf(group);
  return explicit === -1 ? GROUP_ORDER.length : explicit;
}
```

Deprecated is no longer a group, so `TRAILING` and its handling go. Sort deprecated demos last within their group instead — in `compare`, after the group comparison:

```ts
  const ad = a.meta.deprecated ? 1 : 0;
  const bd = b.meta.deprecated ? 1 : 0;
  if (ad !== bd) return ad - bd;
```

- [ ] **Step 8: Strip `group:` from all 68 demos**

64 in the package, 4 in `apps/web`. Find them:

```bash
cd /c/Users/bbend/Desktop/Projects/tickets
rg -l "group:\s*'" packages/web/ui/src apps/web/src
```

Remove the `group: '…',` pair from each `meta` literal. In the same pass, add `deprecated: true` to exactly these seven:

`copy-button` · `field-label` · `item-key` · `rail-label` · `relative-date` · `section-header` · `session-kind-glyph`

Example — `library/primitives/components/copy-button/copy-button.demo.tsx`:

```ts
export const meta = { title: 'CopyButton', deprecated: true, size: 'lg' };
```

- [ ] **Step 9: Prove none survived**

```bash
rg "group:\s*'" packages/web/ui/src apps/web/src
```

Expected: **no matches**.

- [ ] **Step 10: GREEN GATE plus the playground's tests**

```bash
pnpm --filter @tickets/ui test
pnpm --filter @tickets/playground test
pnpm typecheck
```

Expected: all pass **with zero playground edits**. Its sidebar, command palette and eight test fixtures all read or build `meta.group`, and Step 6 kept the field exactly where they expect it. If the playground goes red here, the group ended up somewhere other than `meta` — fix Step 6 rather than the playground.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat(ui): the sidebar reads the tree instead of being told, and Ungrouped stops existing"
```

---

### Task 11: The two edits outside the package, and the final sweep

**Files:**
- Modify: `packages/web/playground/src/page/tabs/docs-panel/docs-panel.test.tsx:26`
- Modify: `packages/web/ui/README` or `CLAUDE.md` references, if any survive

**Interfaces:**
- Consumes: everything above.
- Produces: a green workspace.

- [ ] **Step 1: Fix the playground fixture path**

`packages/web/playground/src/page/tabs/docs-panel/docs-panel.test.tsx`, line 26:

```ts
  const path = opts.path ?? 'packages/web/ui/src/library/primitives/components/pill/pill.demo.tsx';
```

- [ ] **Step 2: Update `CLAUDE.md`**

Line 8 names the tokens output directories. `src/generated/` becomes `src/style/generated/`:

```markdown
- Shared components and tokens live in `packages/web/ui` (`@tickets/ui`). Tokens are GENERATED from `tokens/*.tokens.json` into `styles/generated/` and `src/style/generated/` — never hand-edit either; run `pnpm --filter @tickets/ui tokens:build`. Details in `design-system-adapter.md`.
```

While you are there, add a line describing the new shape, since CLAUDE.md is the map a fresh session reads:

```markdown
- `@tickets/ui` is three layers — `src/style/` (paint), `src/library/` (eight role groups), `src/docs/` (gallery + token pages) — and imports point downward only. Inside a group: `components/` is what you reach for, `parts/` is what those are built from. Full rationale in `docs/superpowers/specs/2026-08-06-ui-package-structure-design.md`.
```

- [ ] **Step 3: Find stale path references in live code**

```bash
cd /c/Users/bbend/Desktop/Projects/tickets
rg "ui/src/components|ui/src/forms|ui/src/table|ui/src/foundation|ui/src/gallery|ui/src/generated" \
   --glob '!node_modules' --glob '!**/*.lock' --glob '!docs/superpowers/**'
```

Fix every hit in **live code and current docs**. Expect a comment in
`apps/web/src/components/eer/view/detail-panel/badge-tone.ts` naming
`packages/web/ui/src/components/domain-free.test.ts`, plus in-package strings in
`library/table/parts/render-error.tsx` and `docs/gallery/collect-demos.test.ts`.

**Leave `docs/superpowers/**` alone.** Roughly twenty historical specs and plans
name the old paths. They are a record of what was true when they were written,
not instructions — rewriting them would falsify the archive. The glob above
excludes them deliberately.

- [ ] **Step 4: Run every check the repo has**

```bash
pnpm typecheck
pnpm --filter @tickets/ui test
pnpm --filter @tickets/web test
pnpm --filter @tickets/playground test
pnpm --filter @tickets/ui tokens:verify
pnpm build
```

Expected: all six pass.

- [ ] **Step 5: Confirm the blast radius matches the spec's claim**

```bash
git diff --stat main -- ':!packages/web/ui' ':!docs'
```

Expected: exactly six files — one playground test fixture, the four `apps/web` demos, and `CLAUDE.md`. **No playground source file** should appear; if `sidebar.tsx` or `command-palette.tsx` is in the list, the group did not stay on `meta` and Task 10 Step 6 needs fixing rather than the playground.

Anything else outside `packages/web/ui` means a symbol stopped being exported. That is a defect in the move; find the barrel that dropped it rather than editing the consumer.

- [ ] **Step 6: Verify the gallery renders as designed**

Start the stack per the `running-the-stack` skill, open the gallery, and confirm:
- nine groups in the sidebar, in `GROUP_ORDER` sequence
- no `Ungrouped`
- the seven deprecated components are badged and sort last within their groups
- `Table` appears as its own group

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "refactor(ui): the last paths that still named the old tree"
```

---

## Self-Review

**Spec coverage.** Every section of the spec maps to a task:

| Spec section | Task |
| --- | --- |
| `style/generated/` move | 1 |
| `library/` parent, forms and table folded in | 2 |
| `inputs/`: contract promoted, `parts/` binned, `components/` bucketed | 3 |
| `primitives/` (actions + display merged) | 4 |
| `overlays/`, menu and dropdown reclassified, `parts/panel/` | 5 |
| `layout/`, `navigation/`, `feedback/` | 6 |
| `forms/`: `components/` + `bindings/`, three "field"s separated | 7 |
| `table/`: `columns/` kept, `parts/` created, no `components/` | 8 |
| `docs/`: gallery + pages, `src/index.ts` down to three re-exports | 9 |
| Deriving the group; authored `group:` deleted from 68 demos; `deprecated` flag; `App` group | 10 |
| `domain-free.test.ts` skip paths | 4, Step 5 |
| `build-tokens.ts` + `package.json` | 1, Steps 3–4 |
| `docs/pages/spec.ts` `?raw` depth | 9, Step 4 |
| Group derived into `meta`, so no playground source changes | 10, Step 6 |
| Playground fixture string | 11, Step 1 |
| `CLAUDE.md` tokens path | 11, Step 2 |
| "Done means" checks | 11, Steps 4–6 |

**Not covered by any task, deliberately** — all listed as out of scope in the spec: splitting `table/parts/` further, retiring deprecated components, the layer lint rule, moving the four `apps/web` demos into the library.

**Placeholder scan.** No `TBD`, no "add error handling", no "similar to Task N". Every barrel is written out in full rather than described, because the engineer may read tasks out of order. The one repeated procedure — the import rewrite — is defined once as `TYPECHECK-FIX LOOP` with the depth table it needs, rather than restated eleven times.

**Type consistency.** `groupFromPath` is named identically in Task 10 Steps 1, 3 and 7. `DemoMeta` loses `group` in Step 6 and every reader is updated in Step 7 (`compare`) and Step 10 (playground tests). `CollectedDemo` gains `group: string` in Step 6, which is what `compare` and the playground sidebar then read. Barrel names in Tasks 3–8 match the symbols the spec's Global Constraints promise to preserve.

**One risk worth naming.** Task 2 is the largest single import-rewrite batch, because `forms/` and `table/` each gain a level while everything they reference stays put. If it proves unwieldy, it splits cleanly at the `git mv` boundaries: rename `components/` → `library/` and commit, then move `forms/`, then `table/`. The gate is the same each time.
