# Design Token Pipeline — Design

**Status:** approved architecture, pending spec review
**Date:** 2026-07-07
**Applies the skill:** `tokenizing-the-design` (this is that skill's gate, built for this repo)

## Goal

Make the design an executable artifact: a machine-readable DTCG token source that
Style Dictionary compiles into an **output-equivalent** `instrument.css`, with a
lint gate forbidding hardcoded values and a CI check that `design-system.html`
cannot drift from the tokens. Zero visual change to the completed redesign.

## Decisions (locked)

- Build tool: **Style Dictionary v4** (first-class DTCG, custom formats).
- Tiers: **primitive + semantic** (component tier omitted — YAGNI for this system).
- Design-source reconciliation: **tokens canonical + a CI check** that the values
  embedded in `design-system.html` still match the tokens.
- Hard guardrail: the generated `instrument.css` must be **output-equivalent** to
  the current hand-authored file; the refactor is invisible or it is wrong.

## Current state (what we're replacing)

`apps/web/src/styles/instrument.css` (324 lines), hand-authored:
- `:root { --ins-*: <light hex> }` — semantic tokens, light theme.
- `[data-theme='dark'] { --ins-*: <dark hex> }` — same names, dark values.
- `@theme inline { --color-*: var(--ins-*) }` — Tailwind v4 utility bridge.
Token groups: neutrals (app/raised/inset/hairline/control/ink/ink-2/ink-3),
accent (+hover/subtle/on-accent), danger (+hover/subtle), kind-* (todo/active/
blocked/done/dropped, each + subtle), opt-* (11 colors, each + subtle), and two
shadows (shadow-sm/lg). Only 2 of 46 UI components carry stray hardcoded hex
(`button.tsx`, `switch.tsx`).

## Architecture

```
primitives.tokens.json  ─┐
semantic.light.tokens.json ├─ Style Dictionary ─→ instrument.css ─→ Tailwind --color-* ─→ components
semantic.dark.tokens.json ─┘        (custom CSS format)   (generated)
```

Primitives hold every raw hex once, named neutrally. Semantic tokens are the
existing `--ins-*` names, each aliasing a primitive — different alias per theme.
Style Dictionary resolves aliases at build time, so the emitted `--ins-*` values
are identical to today's. Primitives never appear in the output CSS.

## Units / files

- `apps/web/src/styles/tokens/primitives.tokens.json` — raw palette (DTCG:
  `$value`/`$type`), every distinct hex used across both themes, plus shadow parts.
- `apps/web/src/styles/tokens/semantic.light.tokens.json` — `--ins-*` names →
  `{primitive}` aliases for light.
- `apps/web/src/styles/tokens/semantic.dark.tokens.json` — same names → dark aliases.
- `apps/web/style-dictionary.config.js` — SD v4 config + a custom CSS format that
  emits the exact `:root` / `[data-theme='dark']` / `@theme inline` blocks in the
  current order.
- `apps/web/scripts/check-design-tokens.mjs` — parses labelled swatch hexes from
  `docs/design/design-system.html` and asserts each equals its token; non-zero
  exit on mismatch.
- `apps/web/src/styles/instrument.css` — becomes generated output (header comment
  marks it generated; do not hand-edit).
- `apps/web/src/ui/button.tsx`, `switch.tsx` — replace stray hex with semantic
  tokens.
- Lint config: `stylelint` + `stylelint-declaration-strict-value` (CSS), and an
  ESLint rule forbidding raw hex in `.tsx`. Token JSON + generated CSS are exempt.
- `apps/web/package.json` — add scripts `tokens:build` and `tokens:check`.
- `.claude/skills/design-system-adapter.md` — update `tokenPipeline`/`testCommands`
  fields, remove the two "GAP" notes.

## Dependencies (added via the add-package skill at build time)

`style-dictionary` (v4), `stylelint` + `stylelint-declaration-strict-value`, and an
ESLint plugin/rule for hardcoded hex in TS/JSX. Each presented for approval before install.

## CI gates (the programmatic guarantees)

1. **Build determinism:** `tokens:build` regenerates `instrument.css`; CI runs it
   then asserts `git diff --exit-code` is clean — code cannot drift from tokens.
2. **No hardcoded values:** lint fails on any raw hex/px in components or
   hand-written CSS (token files + generated CSS exempt).
3. **Spec conformance:** `tokens:check` fails if `design-system.html`'s embedded
   values diverge from the tokens.

## Testing

- **Output equivalence (acceptance):** snapshot current `instrument.css`; build
  from tokens; diff until identical (modulo a one-time formatting normalization
  commit if needed). Then measure a handful of gallery computed styles (accent
  button bg, a kind badge fg/bg in both themes) before/after — must be identical.
- **Build determinism:** second `tokens:build` produces no diff.
- **Lint:** a planted raw hex in a `.tsx` fails; the 2 real offenders fixed and pass.
- **Spec check:** mutate one token, confirm `tokens:check` flags the mismatch and
  names the token; revert.

## Rollout / risk

The only risk is altering working CSS. Mitigated by output-equivalence as a hard
acceptance test and a before/after computed-style measurement on the gallery. If
byte-equivalence proves impractical due to formatting, a single normalization
commit re-formats the current file first, after which generation is diff-clean.

## Non-goals

- No component-tier tokens (YAGNI at this size).
- No new spacing/type/radius tokens beyond what `instrument.css` already defines
  (would break output-equivalence; separate future work).
- No design-tool (Figma) round-trip — the design source is `design-system.html`.
- No visual-regression runner — that is the separate next plan (step 3).
