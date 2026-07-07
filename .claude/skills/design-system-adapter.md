# Design-System Adapter — tickets

Filled instance of `_adapter-template.md` for this repo. The four generic
design→code skills read this file for every stack-specific detail; nothing
here should need to leak back into those skills.

## designSource

- `docs/design/design-system.html` — the Instrument design spec, exported
  from the Claude Design project. This is the visual reference/baseline for
  every component.
- `apps/web/src/styles/instrument.css` — holds the `--ins-*` CSS custom
  properties (the actual token values consumed by the app).
- GAP: no visual-baseline images exist yet (no screenshot corpus to diff
  against — verification today is by measurement against the spec doc, not
  image comparison).

## tokenPipeline

- Source of truth: `apps/web/src/styles/tokens/*.tokens.json` — DTCG-format
  primitive + semantic (light/dark) token files.
- Codegen: `pnpm --filter @tickets/web tokens:build` runs
  `scripts/build-tokens.mjs`, which splices the generated `--ins-*` /
  `--color-*` custom-property regions into
  `apps/web/src/styles/instrument.css` between `/* tokens:… */` markers.
  Everything outside those markers (Tailwind theme mappings, component CSS)
  is hand-authored and untouched by codegen.
- Gates: `tokens:lint` (`scripts/scan-hardcoded-values.mjs`) scans
  style-context source for hardcoded/literal values that should be tokens;
  `tokens:check` (`scripts/check-design-tokens.mjs`) checks the built tokens
  conform to `docs/design/design-system.html`. Both are aggregated (with a
  fresh-build drift check) behind `pnpm --filter @tickets/web tokens:verify`.

## workbench

- The `/gallery` route renders primitives in isolation, one state at a time.
- Run: `WEB_DEV_PORT=4620 pnpm --filter @tickets/web dev` (the docker API
  must be up first: `docker compose up -d`).
- View at http://localhost:4620/gallery.

## testCommands

- Unit/component tests: `pnpm --filter @tickets/web test` (vitest).
- Token pipeline gate: `pnpm --filter @tickets/web tokens:verify` (rebuilds
  tokens, fails if `instrument.css` drifts from a fresh build, then runs
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
