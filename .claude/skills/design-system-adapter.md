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
- **A token file plays one of two roles — check which before "fixing" one.**
  Only five of the nine are read by the generator, by design:
  - *Emitted* — the value lives in the JSON and codegen puts it into CSS:
    `colors.{light,dark}`, `shadows.{light,dark}`, `semantic`.
  - *Sanctioned rungs* — the value lives in the Tailwind class and the JSON
    records which rungs may be used: `layout` (border/ring/z/breakpoint) and
    `motion`'s durations. `duration-200` is 200ms because the class says so;
    emitting `--duration-200` would create the second copy that is the only way
    the two could disagree. `spec.test.ts` asserts the sheet declares NO token
    for these, so wiring them into the generator breaks the suite on purpose.
  - `radius` and `typography` straddle both: their values are hand-authored in
    `styles/theme.css` (next to the `initial` clears that retire off-scale rungs
    — enforcement DTCG cannot express), and `foundation/spec.ts`'s `drift()`
    matches the two copies **by value**, so an edit to either side fails
    `spec.test.ts` rather than passing silently.
  - There is no `tones.tokens.json`. The hue list is derived from the keys of
    `colors.light.tokens.json` — the ramps are the only place a hue can exist,
    so a separate list was just a second copy that could disagree.
- **All CSS lives in `packages/web/ui/styles/`, and generated files are whole
  files.** Nothing is spliced into hand-authored content any more:
  - `index.css` — the entry (`@tickets/ui/tokens.css` resolves here). Layer
    declaration, imports, `@source`, `@custom-variant`, `@layer base`, keyframes.
  - `theme.css` — AUTHORED `@theme inline`: fonts, type scale, weights, radius,
    easings. **Imported before `tokens.generated.css`**, because `--color-*:
    initial` lives here and after the generated colours it would wipe them.
  - `tokens.generated.css` — GENERATED whole by `scripts/generators/build-tokens.ts`.
  - `safelist.generated.css` — GENERATED whole by `scripts/extract-safelist.mjs`.
  - `prose.css` — authored `.rt` rich-text rules.
- Codegen: `pnpm --filter @tickets/ui tokens:build`. Also writes
  `src/style/tones/tones.generated.ts` (the tone vocabulary), which is TypeScript
  and so sits with the code that imports it.
- Gates: `pnpm --filter @tickets/ui tokens:verify` is now ONLY a freshness check —
  it regenerates and fails if the three generated artifacts differ from a fresh
  build. It no longer validates anything about the values themselves.
  The JSON↔CSS equivalence for the hand-written families is a *unit test*
  (`foundation/spec.test.ts`), not part of `tokens:verify` — it runs under
  `pnpm --filter @tickets/ui test`, and is the last automated check on tokens.
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
