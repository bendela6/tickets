# @tickets/ui package structure — eight groups, one shape

Approved 2026-08-06. Reviewed as an artifact first:
<https://claude.ai/code/artifact/886ba54d-dd96-425c-89ae-c53c88a9bdd1>

Scope: the internal layout of `packages/web/ui/src`. No component behaviour
changes, no exported name changes, no consumer changes.

## Why this is cheap, and why that matters

`@tickets/ui` declares exactly one entry point — `"." : "./src/index.ts"` — and
a sweep of `apps/` and `packages/` finds **zero deep imports**. Every symbol
reaches every consumer through one barrel.

Five things consume it:

| Consumer | Files importing `@tickets/ui` |
| --- | --- |
| `apps/web` | 125 |
| `@tickets/playground` | 31 |
| `apps/icon` | 12 |
| `apps/board` | 10 |
| `@tickets/icon-studio` | 4 |

So the entire reorganisation is invisible outside the package. That is what
makes it worth doing properly rather than surgically: the blast radius is the
package's own relative imports, which the compiler checks exhaustively.

## What is wrong today

1. **`components/inputs/` mixes kinds.** 26 controls sit as siblings of
   `control/` (the shared contract), `field/` and `toggle/` (class builders),
   and `chip/`, `popup/`, `option-row/`, `combobox-list/` (sub-components used
   only by other controls). Nothing in the tree says which is which.
2. **Three unrelated things are called "field".** `inputs/field/` (the bordered
   shell), `components/field-label/` + `components/field-error/` (label and
   error chrome, filed out among Avatar and Toast), and `forms/inputs/*-field`
   (the 25 form-engine adapters).
3. **`components/` is a flat bag of 34.** No grouping at all.
4. **The top level mixes categories.** `table/` is a component sitting as a peer
   of `style/`; `foundation/` is documentation, not shipped code; `generated/`
   is token values divorced from the `style/` code that reads them.
5. **`components/panel/` holds no Panel component** — four hooks, consumed only
   by `drawer` and `side-panel`.
6. **The gallery's grouping is hand-typed and can disagree with the tree.**
   All 68 demos declare `meta.group`; seven declare `'Ungrouped'` — Dialog,
   DialogFooter and ScreenState in the package, plus all four `apps/web` demos.
7. **`menu` and `dropdown` are filed as things you press.** `Menu` is a
   portalled Radix `DropdownMenu`; `Dropdown` is built on this package's
   `Popover`. Both are surfaces that open.

## The nine locked decisions

1. **Group components by role**, not by composition depth or stability.
2. **Three layers, one arrow: `docs → library → style`.** Imports point
   downward only.
3. **`inputs/` promotes its contract and bins its parts.** `control/control.ts`
   becomes `inputs/contract.ts`; the other six shared pieces go to
   `inputs/parts/`.
4. **The gallery's group is derived from the directory.** `meta.group` is
   deleted from all 68 demos — 64 in the package, 4 in `apps/web` — and
   `deprecated` becomes a flag.
5. **`forms/` is a peer group, not a layer.** It depends on `inputs`, but
   `table` depends on `primitives` and `overlays/drawer` on `overlays/popover` —
   groups importing groups is already normal, so forms was a peer sitting one
   directory too high.
6. **The parent of the groups is `library/`** (renamed from `components/`).
7. **`components/` is the uniform leaf bucket inside every group** — freed by
   decision 6.
8. **`table/` is its own group and keeps `columns/`.** It is an adapter, not a
   component set; see "Why table is shaped differently".
9. **`actions/` and `display/` merge into `primitives/`**, with `menu` and
   `dropdown` reclassified into `overlays/` first.

## The target structure

```
src/
  index.ts                three re-exports and nothing else
  style/            (23)  ① paint — depends on nothing
    generated/            token values, moved from src/generated/
    cn/ focus-ring/ tones/ variants/
    css-custom-properties.ts
  library/         (345)  ② the vocabulary — eight groups
    primitives/      (43) avatar button copy-button dot icon item-key
                          pill prose relative-date session-kind-glyph status-dot
    inputs/         (130) contract.ts · parts/ · 26 controls
    forms/           (49) field-label field-error field-wrapper · bindings/
    table/           (28) columns/ · parts/ · table-render.ts
    layout/          (22) card row stack rail-label section-header
    navigation/      (12) tabs tree
    overlays/        (41) dialog dialog-footer drawer dropdown menu
                          popover side-panel tooltip · parts/panel/
    feedback/        (18) progress screen-state spinner toast
    index.ts · domain-free.test.ts
  docs/             (33)  ③ how the library documents itself
    gallery/              demo-collection machinery
    pages/                the foundation token pages
  test/setup.ts     (1)
```

385 files today, 403 after: 19 added, 1 deleted.

## The group shape

Every group folder is built from the same vocabulary. A name means the same
thing in every group it appears in.

| Folder | Means | Who has it |
| --- | --- | --- |
| `contract.ts` | the group's shared type contract | inputs |
| `parts/` | pieces its surface is assembled from | inputs, overlays, table |
| `components/` | the React components you reach for by name | every group but table |
| `bindings/` | form-engine adapters, one per control | forms |
| `columns/` | column renderer factories | table |
| `index.ts` | the group barrel | every group |

`components/` holds one directory per component, so a component keeps its own
filenames — `field-label.tsx` stays `field-label.tsx`.

### `parts/` is not `_internal/`

`apps/web/src/ui/status-select.tsx` imports `fieldClass`, `fieldState` and
`ComboboxList` to build a control this library does not ship. Naming the folder
`_internal/` would make that app a rule-breaker; `parts/` makes it a builder.
The barrels keep exporting everything in `parts/`.

### Why table is shaped differently

`table/index.ts` states it: "The engine is `@tickets/table`. This subtree is the
styled adapter." There is no `<Table>` component. What a caller reaches for is
`tableRender<T>()` — a generic factory returning twelve render slots — and seven
`*Column` factories that return renderers, not elements.

So `components/` would be naming taxonomy rather than describing contents. The
rule stays honest instead: **a group's `components/` holds its React components,
when it has any.** Table's named surface is `columns/`; its twelve `render-*`
slots and `metrics.ts` go to `parts/`.

## The layer rule, and its one exemption

Shipped code imports downward only: `docs → library → style`. Within `library/`,
groups may import each other.

`*.demo.tsx` files are exempt, and deliberately so: they sit beside their
component but import `definePlayground` and friends from `docs/gallery`. A demo
*is* documentation that happens to live next to its subject, and colocation is
what keeps it honest.

The enforceable rule is therefore: **a file that is neither `.demo.` nor
`.test.` imports downward only.**

## Three things called "field", told apart by path

No file is renamed to achieve this. The paths do the work, so `FieldLabel`,
`FieldError` and `FieldWrapper` keep their names and the 11 `apps/web` call
sites do not move.

| Path | What it is |
| --- | --- |
| `library/inputs/parts/field/` | the bordered shell a text control wears (`fieldClass`, `fieldState`) |
| `library/forms/components/field-{label,error,wrapper}/` | the labelled row: caption, control, message |
| `library/forms/bindings/*-field.tsx` | the form-engine adapters |

## The eleven edits that are not file moves

Everything else is `git mv` plus import rewrites the compiler will find.

| File | Change |
| --- | --- |
| `src/index.ts` | Three re-exports — `./style`, `./library`, `./docs` — where it named six things. The `sideEffects: false` comment about the eager demo globs moves with it and stays true. |
| `library/index.ts` | Was `components/index.ts`. Re-exports eight groups instead of 34 component folders; `forms` and `table` join the list rather than being exported from the root. |
| `docs/gallery/collect-demos.ts` | Derives `group` from the demo's path instead of reading `meta.group` — see "Deriving the group" below. `GROUP_ORDER` becomes `['Primitives', 'Inputs', 'Forms', 'Table', 'Layout', 'Navigation', 'Overlays', 'Feedback', 'App']` — the order the tree lists them in, most-reached-for first. `Ungrouped` disappears; every file is now somewhere. |
| `docs/gallery/types.ts` | `DemoMeta.group` removed, `deprecated?: boolean` added. Validation stops requiring a group and starts rejecting one. |
| 64 × `packages/web/ui/**/*.demo.tsx` | `group:` deleted from every `meta`. The 7 deprecated components gain `deprecated: true`. |
| 4 × `apps/web/**/*.demo.tsx` | `group: 'Ungrouped'` deleted from Cost Meter, Message Stream, Prompt Composer and StatusSelect. They derive to `App`. |
| `library/domain-free.test.ts` | Scans `library/` rather than `components/`, and its two skip-prefixes are paths: `icon/registry` → `primitives/components/icon/registry`, `session-kind-glyph/` → `primitives/components/session-kind-glyph/`. Silently stops guarding if missed. |
| `scripts/generators/build-tokens.ts` | Emits TypeScript into `src/style/generated/`. The CSS half keeps writing to `styles/generated/` at the package root — unchanged. |
| `package.json` | `tokens:verify`'s `git diff --exit-code` path list follows the generator. |
| `docs/pages/spec.ts` | Its six `?raw` imports of `../../styles/generated/*.css` gain one `../`. |
| `library/inputs/contract.ts` | Renamed from `inputs/control/control.ts`. `inputs/control/index.ts` is the one file this reorg deletes. Exported names are untouched: `ControlProps`, `ControlSize`, `Option`, `CONTROL_LADDER`, `disabledClass`. |
| `packages/web/playground/src/page/tabs/docs-panel/docs-panel.test.tsx` | One hardcoded fixture string — `'packages/web/ui/src/components/pill/pill.demo.tsx'` — becomes `…/src/library/primitives/components/pill/pill.demo.tsx`. |

## Deriving the group

`apps/web/src/routes/gallery-route.tsx` merges its own demos with the package's
via `prepareDemos([...packageDemos, ...webDemos])`, and both maps are already
rebased onto workspace-relative roots — `packages/web/ui/src` and `apps/web/src`.
Derivation reads those paths, so it covers both sets without either package
knowing about the other:

- `packages/web/ui/src/library/<group>/…` → that group, title-cased.
- `apps/web/src/…` → `App`.
- Anything else → a demo error card, the same treatment a demo missing its
  `title` already gets. A silent fallback group is what produced `Ungrouped`.

`App` is the honest name for the four app-side demos: Cost Meter, Message
Stream, Prompt Composer and StatusSelect are `apps/web` components, and no
amount of grouping in this library will make them library components.

## Deprecation after `meta.group` goes

Seven components are deprecated today: `copy-button`, `field-label`,
`item-key`, `rail-label`, `relative-date`, `section-header`,
`session-kind-glyph`. They live in their role group like anything else and carry
`meta.deprecated: true`.

The playground sidebar keeps today's behaviour — deprecated entries collect into
a group pinned to the bottom and are badged — so "do not pick from here by
accident" survives while the directory stays the source of truth for role.

## Done means

- `pnpm typecheck` clean — this is the main check, since every broken relative
  import is a type error.
- `pnpm --filter @tickets/ui test` and `pnpm --filter @tickets/playground test`
  green.
- `pnpm --filter @tickets/ui tokens:verify` green — proves the generator's new
  output path and the `package.json` diff guard agree.
- `pnpm build` clean.
- All five consumers compile with **zero changes to shipped source** —
  `apps/web`, `apps/icon`, `apps/board`, `@tickets/playground`,
  `@tickets/icon-studio`. Exactly two edits land outside `packages/web/ui`: the
  playground fixture string, and `group:` dropped from four `apps/web` demos.
  Any *other* edit needed outside the package means a symbol stopped being
  exported — a defect in the move, not a consequence of it.
- The gallery renders nine groups (eight plus `App`), no `Ungrouped`, and the 7
  deprecated components appear badged in the pinned bottom group.
- `rg "group:\s*'" packages/web/ui/src apps/web/src` returns nothing — no demo
  anywhere still declares a group.

## Not in scope

- Splitting `table/parts/` further. Twelve `render-*` files at one level is its
  own conversation.
- Retiring any of the 7 deprecated components.
- The lint rule that would enforce the layer arrow. The structure makes it
  possible; writing it is separate work.
- Any change to `packages/web/playground` beyond the single fixture string, or
  to `apps/web` beyond dropping `group:` from its four demos.
- Moving the four `apps/web` demos into the library. They are app components and
  stay app components; `App` names that rather than hiding it.
- Curating which components *should* exist. This moves what is there.
