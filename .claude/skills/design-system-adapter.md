# Design-System Adapter — tickets

Filled instance of `_adapter-template.md` for this repo. The four generic
design→code skills read this file for every stack-specific detail; nothing
here should need to leak back into those skills.

## designSource

- `docs/design/design-system.html` — the Instrument design spec, exported
  from the Claude Design project. This is the visual reference/baseline for
  every component.
- `packages/web/ui/src/tokens.css` — holds the `--ins-*` CSS custom
  properties (the actual token values consumed by the app).
- GAP: no visual-baseline images exist yet (no screenshot corpus to diff
  against — verification today is by measurement against the spec doc, not
  image comparison).

## tokenPipeline

- Source of truth: `packages/web/ui/tokens/*.tokens.json` — DTCG-format, at the
  package root rather than under `src/`, because they are what the package is
  built FROM, not code it ships. There is no primitive→semantic alias layer: a
  ramp step IS the token (`gray-1` is the app background, `red-9` the solid fill).
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
  | *(safelist)* | `extract-safelist.mjs` | — | `safelist.css` | — |

  Each generator is one self-contained function returning `{ css, ts }`.
  `colors` holds ramps, roles, surfaces and literals — all `--color-*`, so all
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
  `spec.test.ts` (contracts — naming rules, ramp uniformity, what must NOT be
  emitted) and the generators' own build-time assertions (theme symmetry per
  family, every ramp carries the same rungs, every role resolves).
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
  tokens, fails if `styles/tokens.generated.css`, `styles/safelist.generated.css`
  or `src/style/tones/tones.generated.ts` drifts from a fresh build).
  Freshness only — no value or vocabulary checking remains.
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

- Components live in `apps/web/src/ui`.
- Headless layer idiom: React hooks + radix-ui primitives (behavior/state
  via hooks and radix, markup/styling layered on top).
- Variant styling: Tailwind utility classes composed through a `cn()`
  helper (`tailwind-merge`-based) — no separate variant-config tool (e.g. no
  `cva`) in use.
- Stack: React 19, TanStack Router/Query, Tailwind v4 with **preflight OFF**.

## knownTraps

1. **Tailwind preflight is OFF.** Native controls (`input`, `button`,
   `select`) leak user-agent margin, padding, background, and font — they
   need `appearance-none m-0 shrink-0` plus explicit `border`/`bg` classes to
   look intentional.
2. **Legacy `apps/web/src/styles/globals.css` is unlayered.** Its bare
   element selectors (e.g. `button { font: inherit }`) beat every Tailwind
   utility class by specificity/order, including on already-redesigned
   screens, until that screen's legacy CSS is deleted.
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
