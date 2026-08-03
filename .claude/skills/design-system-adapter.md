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

- Source of truth: `packages/web/ui/src/tokens/next/*.tokens.json` — DTCG-format.
  There is no primitive→semantic alias layer any more: a ramp step IS the token
  (`gray-1` is the app background, `red-9` the solid fill).
- **A token file plays one of two roles — check which before "fixing" one.**
  Only six of the ten are read by the generator, by design:
  - *Emitted* — the value lives in the JSON and codegen puts it into CSS:
    `colors.{light,dark}`, `shadows.{light,dark}`, `semantic`, `tones`.
  - *Sanctioned rungs* — the value lives in the Tailwind class and the JSON
    records which rungs may be used: `layout` (border/ring/z/breakpoint) and
    `motion`'s durations. `duration-200` is 200ms because the class says so;
    emitting `--duration-200` would create the second copy that is the only way
    the two could disagree. `spec.test.ts` asserts the sheet declares NO token
    for these, so wiring them into the generator breaks the suite on purpose.
  - `radius` and `typography` straddle both: their values are hand-written into
    the `@theme inline` block (next to the `initial` clears that retire
    off-scale rungs — enforcement DTCG cannot express), and
    `foundation/spec.ts`'s `drift()` matches the two copies **by value**, so an
    edit to either side fails `spec.test.ts` rather than passing silently.
- Codegen: `pnpm --filter @tickets/ui tokens:build` runs
  `packages/web/ui/scripts/build-tokens.mjs`, which splices the generated `--ins-*` /
  `--color-*` custom-property regions into
  `packages/web/ui/src/tokens/tokens.css` between `/* tokens:… */` markers and
  writes `src/style/tones/tones.generated.ts`; then `extract-safelist.mjs`
  writes `src/tokens/safelist.generated.css`.
  Everything outside those markers (Tailwind theme mappings, component CSS)
  is hand-authored and untouched by codegen.
- Gates: `tokens:lint` (`packages/web/ui/scripts/scan-hardcoded-values.mjs`) scans
  style-context source for hardcoded/literal values that should be tokens;
  `tokens:check` (`packages/web/ui/scripts/check-design-tokens.mjs`) checks the built tokens
  conform to `docs/design/design-system.html`. Both are aggregated (with a
  fresh-build drift check) behind `pnpm --filter @tickets/ui tokens:verify`.
  The JSON↔CSS equivalence for the hand-written families is a *unit test*
  (`foundation/spec.test.ts`), not part of `tokens:verify` — it runs under
  `pnpm --filter @tickets/ui test`.

## workbench

- The `/gallery` route renders primitives in isolation, one state at a time.
- Run: `WEB_DEV_PORT=4620 pnpm --filter @tickets/web dev` (the docker API
  must be up first: `docker compose up -d`).
- View at http://localhost:4620/gallery.

## testCommands

- Unit/component tests: `pnpm --filter @tickets/web test` (vitest).
- Token pipeline gate: `pnpm --filter @tickets/ui tokens:verify` (rebuilds
  tokens, fails if `packages/web/ui/src/tokens.css` drifts from a fresh build, then runs
  `tokens:lint` + `tokens:check`).
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
5. **Bare `border` and bare `rounded` still compile.** Tailwind defines both as
   static utilities, so `--border-*`/`--radius-*: initial` cannot remove them.
   They are retired by convention; `packages/web/ui/src/tokens/vocabulary.test.ts`
   is the only thing stopping them coming back. A new component that writes
   `border` instead of `border-1` will render correctly and fail the suite.
   The bare-`border` scanner matches the bare WORD, so it cannot distinguish a
   class from prose or a data literal — `packages/web/ui/scripts/border-baseline.json`
   holds 41 reviewed non-class hits, and the test asserts both `fresh === []`
   and `fixed === []`, so the list can only shrink, never grow with new excuses.
