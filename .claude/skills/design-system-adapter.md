# Design-System Adapter — tickets

Filled instance of `_adapter-template.md` for this repo. The four generic
design→code skills read this file for every stack-specific detail; nothing
here should need to leak back into those skills.

## designSource

- `docs/design/design-system.html` — the Instrument design spec, exported
  from the Claude Design project. This is the visual reference/baseline for
  every component.
- `packages/web/ui/styles/generated/*.css` — the `--ins-*` custom properties
  the app actually consumes, one file per token family.
- GAP: no visual-baseline images exist yet (no screenshot corpus to diff
  against — verification today is by measurement against the spec doc, not
  image comparison).

## tokenPipeline

- Source of truth: `packages/web/ui/tokens/*.tokens.json` — DTCG-format, at the
  package root rather than under `src/`, because they are what the package is
  built FROM, not code it ships. There is no primitive→semantic alias layer: a
  hue step IS the token (`gray-1` is the app background, `red-9` the solid fill).
- **One family per row, one name across all four tiers.** Adding a family is a
  new generator file plus one entry in `build-tokens.ts`, which holds no
  knowledge of any family itself.

  | family | generator | JSON | CSS | TS |
  | --- | --- | --- | --- | --- |
  | colors | `generators/colors.ts` | `colors` | `colors.css` | `colors.ts` |
  | typography | `generators/typography.ts` | `typography` | `typography.css` | `typography.ts` |
  | border | `generators/border.ts` | `border` | `border.css` | `border.ts` |
  | motion | `generators/motion.ts` | `motion` | `motion.css` | `motion.ts` |
  | shadows | `generators/shadows.ts` | `shadows` | `shadows.css` | `shadows.ts` |
  | breakpoints | `generators/breakpoints.ts` | `breakpoints` | `breakpoints.css` | `breakpoints.ts` |
  | spacing | `generators/spacing.ts` | `spacing` | `spacing.css` | `spacing.ts` |
  | *(safelist)* | `extract-safelist.mjs` | — | `safelist.css` | — |

  Each generator is one self-contained function returning `{ css, ts }`.
  `colors` holds hues, roles, surfaces and literals — all `--color-*`, so all
  behind one `--color-*: initial`.
- **Not everything in a token file is emitted, by design.** `motion.duration`
  and `border.width`/`border.ring` produce no CSS: Tailwind has no namespace for
  them, so `duration-200` is 200ms and `border-7` is 7px because the class says
  so. Measured — any integer compiles. Those lists are documentation the build
  cannot enforce; `spec.test.ts` asserts the sheet declares NO token for them.
- **All CSS lives in `packages/web/ui/styles/`; generated files are whole
  files.** Nothing is spliced into hand-authored content:
  - `index.css` — the entry (`@tickets/ui/tokens.css` resolves here). Layer
    declaration, imports, `@source`, `@custom-variant`, `@layer base`, keyframes.
  - `generated/*.css` — one per family, each carrying its own `initial` clear
    above the values it applies to. That is what makes the `@import` list
    order-independent: no file can wipe another's namespace.
  - `prose.css` — authored `.rt` rich-text rules.
- **Generated TypeScript lives in `src/generated/`**, one file per family plus a
  regenerated `index.ts` barrel. `foundation/` imports these rather than reading
  raw JSON, so `cn.ts`'s registered type scale and `use-is-narrow`'s breakpoints
  cannot fall behind the tokens. The contrast maths in `foundation/colors` stays
  hand-written — that is logic, not data.
- Codegen: `pnpm --filter @tickets/ui tokens:build`.
- Gates: `pnpm --filter @tickets/ui tokens:verify` is ONLY a freshness check —
  it regenerates and fails if the generated artifacts differ from a fresh build.
  It validates nothing about the values themselves.
  What remains beyond that runs under `pnpm --filter @tickets/ui test`:
  `spec.test.ts` (contracts — naming rules, hue uniformity, what must NOT be
  emitted) and the generators' own build-time assertions (theme symmetry per
  family, every hue carries the same steps, every role resolves).
  `drift()` was deleted 2026-08-04: it compared the token JSON against CSS
  generated FROM that JSON, so every row read "matched" by construction.
- **Three gates were deleted on 2026-08-04.** Know what is no longer caught:
  - `tokens:lint` / `scan-hardcoded-values.mjs` — nothing objects to
    `bg-[#3b82f6]`, a hex in an inline `style=`, or a colour written straight
    into hand-authored CSS.
  - `tokens:check` / `check-design-tokens.mjs` — nothing compares the tokens to
    `docs/design/design-system.html`. The design file is still the spec of
    record, but drift from it is now found by eye or not at all.
  - `vocabulary.ts` + its two baselines — bare `border`/`rounded` and arbitrary
    `border-[1.5px]`/`rounded-[7px]` all compile silently.

## workbench

- The `/gallery` route renders primitives in isolation, one state at a time.
- Run: `WEB_DEV_PORT=4620 pnpm --filter @tickets/web dev` (the docker API
  must be up first: `docker compose up -d`).
- View at http://localhost:4620/gallery.

## testCommands

- Unit/component tests: `pnpm --filter @tickets/web test` (vitest).
- Token pipeline gate: `pnpm --filter @tickets/ui tokens:verify` (rebuilds
  tokens, fails if any file under `styles/generated/` or `src/generated/` drifts
  from a fresh build). Freshness only — no value or vocabulary checking remains.
- **Never assert token VALUES in a test.** A test listing the twelve type rungs
  or the four radius values has to be edited every time a designer changes one,
  and it can only fail if someone copied the JSON wrong twice. Assert the
  contracts that survive a value change instead: naming rules (`text-13` IS
  13px), shapes (a size token carries no line-height), and what must NOT exist
  (no `--border-*`/`--z-*` token; `--radius-*: initial` precedes the rungs).
  Assertions against inline fixtures are fine — they test the parser, not the
  token set.
- GAP: no visual-regression runner wired up yet (no run command, no
  baseline-update command).
- GAP: no automated accessibility (axe or equivalent) scan wired up yet.

## componentConventions

- Components live in `packages/web/ui/src/components`. A handful of
  app-specific ones remain in `apps/web/src/ui`.
- **The ten form controls are in `components/inputs/`**, with the four pieces
  only they use: `control` (the contract), `field` (the bordered chrome),
  `combobox-list` (the popup) and `toggle` (the shared label row).
- **Every control answers to `ControlProps<T>`** — `value` in,
  `onChange(value, event?)` out, plus `size`/`tone`/`disabled`/`readOnly`. Two
  parts of that are easy to get wrong from outside:
  - the event rides SECOND because the table's select cell reads `shiftKey` to
    extend a row range; a value-only signature broke that silently;
  - `tone` unset is the resting neutral state, NOT a quiet `'primary'`. The
    bordered fields leave it undefined; only the mark controls default.
- The layer above is `forms/inputs/*` — `XField`, bound to `@tickets/form`. The
  seam anything GENERATING a form targets is `InputKind` + `ValueOfKind` in
  `forms/registry.ts`, derived from `baseInputs` with a compile-time drift
  guard. Those kind strings are serialised into stored FormConfigs, so renaming
  one is a data migration.
- Headless layer idiom: React hooks + radix-ui primitives (behavior/state
  via hooks and radix, markup/styling layered on top).
- Variant styling: Tailwind utility classes composed through a `cn()`
  helper (`tailwind-merge`-based) — no separate variant-config tool (e.g. no
  `cva`) in use.
- Stack: React 19, TanStack Router/Query, Tailwind v4 with **preflight ON**
  (`styles/index.css` line 8 imports it into the `base` layer).

## knownTraps

0. **`--spacing` is 1px, so a number in a class name IS pixels.** `p-16` is 16px,
   `gap-8` is 8px. Tailwind ships `.25rem`; this repo overrides it (2026-08-04)
   so spacing reads like `text-13` and `leading-19`. Anything written against
   the stock scale — copied from Tailwind docs, an AI suggestion, or a branch
   cut before that date — will render at a quarter size and still compile.
   There is also no `--leading-*` ladder any more: at 1px the spacing fallback
   produces N px for every integer, which is what the ladder used to state.

1. **Preflight is ON** — it was off historically, and that is where the
   `appearance-none m-0 shrink-0` habit in older components comes from. Those
   are now mostly redundant but harmless. `styles/index.css` adds a small base
   block AFTER preflight for the handful it does not set: `cursor: pointer` on
   buttons, `background-image: none`, and `:disabled { cursor: default }`.
2. **Unlayered CSS outranks every layered rule, whatever the specificity.**
   The legacy `globals.css` that used to bite here is gone, but the hazard is
   structural, not historical: any third-party stylesheet imported without
   `layer(...)` beats all of Tailwind. `styles/index.css` handles the one live
   case by declaring `@layer xterm, …` first and importing `xterm.css` into that
   bottom layer. A new third-party stylesheet must be wrapped the same way.
3. **`twMerge` drops a color class when it sits next to a custom text-size
   token** (patched in `cn.ts`, but watch for regressions). If a color class
   silently vanishes from the rendered DOM, inspect the `cn()`/`twMerge`
   output before assuming the JSX is wrong.
4. **`components/settings/fields-settings.tsx` PALETTE hardcodes the 11
   option-color light hexes as persisted API data** — duplicates
   `--ins-opt-*`; a known drift point not yet covered by `tokens:check`
   (future work).
5. **Bare `border` and bare `rounded` still compile, and NOTHING now stops them.**
   Tailwind defines both as static utilities, so `--border-*`/`--radius-*: initial`
   cannot remove them. The `vocabulary.ts` scan and its two reviewed baselines
   enforced the `border-1` / `rounded-sm` spelling; they were deleted 2026-08-04.
   Both bare forms render identically to their rung (`border` = `border-1` = 1px;
   `rounded` = `rounded-sm` = 4px), so what was lost is one spelling per concept,
   not correct output. Off-scale ARBITRARY values (`border-[1.5px]`,
   `rounded-[7px]`) are likewise unguarded now; the cleared rungs
   (`rounded-xs`/`2xl`/`3xl`/`4xl`) still fail loudly because `initial` makes them
   compile to nothing.
6. **A demo that declares plain `{ name, render }` literals AND has a playground
   never renders those literals.** `state-grid.tsx` prefers the derived axes
   when a playground exists, so authored states are silently dropped — several
   controls' states were invisible in `/gallery` for as long as they had one.
   Use `defineState()` for a demo with a playground, and note that mixing the
   two forms in one file is a hard `collectDemos` error, so it is all-or-nothing
   per file.
7. **A NEW `*.demo.tsx` does not appear in a running dev server.** The gallery
   collects through `import.meta.glob('../**/*.demo.tsx', { eager: true })`, and
   Vite does not re-evaluate an eager glob when a file is added — the demo
   collects fine under vitest while `/gallery` keeps the old list, which reads
   as "my demo is broken". Touch `src/gallery/demos.ts` to invalidate it, or
   restart the dev server. Editing an EXISTING demo is fine.
8. **Read-only has two spellings, and one of them is illegal on a button.**
   `aria-readonly` is not a permitted attribute on `role="button"`, so the three
   popover triggers (Combobox, MultiCombobox, DatePicker) use `aria-disabled`
   instead — axe's `aria-allowed-attr` is what catches this. Never substitute
   the `disabled` ATTRIBUTE for read-only anywhere: it drops the tab stop and
   drops the value from form submission, and a field locked by permission still
   owes both.
9. **The focus ring is `focusRing()` in `src/style/focus-ring/`, and nothing else.**
   Five components (Button, the field shell, the toggle marks, Switch, Slider)
   used to spell it out themselves, which is how all five ended up wearing a
   ring nobody could see — the rung was `-3`, a fill tint measuring **1.00:1**
   against the dark ground and 1.20:1 against the light one, far under the 3:1
   WCAG 2.2 asks of a focus indicator. Never write `ring-*` on a control; call
   `focusRing(hue, trigger)`. The trigger is the only thing a caller chooses:
   `focus-visible` (default, for anything clicked AND tabbed), `focus` (a text
   field, which should ring whenever it holds the caret), `focus-within` (a
   composite whose shell never matches `:focus`). Tests assert
   `.toContain(focusRing(hue))` rather than any rung, so they follow a change
   instead of blocking it.
10. **`ring-<number>` takes INTEGERS only — `ring-1.5` compiles to nothing.**
    Not an error, not a warning: the utility silently does not exist, so the
    control keeps its ring colour and its ring offset and paints no ring at all,
    which looks like a cascade problem and is not one. Use `ring-[1.5px]`. The
    sibling trap is `ring-offset-<n>` with no colour — Tailwind's
    `--tw-ring-offset-color` defaults to **white**, drawing a white hairline
    around every control in the dark theme, so an offset ring MUST name its
    surface (`ring-offset-surface-raised` here).
11. **A regenerated safelist does not reach a RUNNING dev server.** `tokens:build`
    rewrites `styles/generated/safelist.css`, but Vite keeps serving the CSS it
    compiled at boot, so every newly-interpolated class is on the element and
    has no rule behind it. It reads exactly like a cascade bug — the classes are
    right there in the DOM — and it is not one. Measured 2026-08-05: the whole
    Soft Fill focus treatment (`focus:border-{hue}-11`, `focus:ring-{hue}-9/22`,
    `focus:bg-surface-field`) was absent from the served CSS and present three
    times over in a fresh `pnpm --filter @tickets/web build`. Restart the dev
    server after `tokens:build`, or verify against a production build. Classes
    written out literally in source are unaffected — only interpolated ones go
    through the safelist, which is why the resting floor looked right while
    focus did nothing.
