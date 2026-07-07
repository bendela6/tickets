# Design Token Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the hand-authored `--ins-*` token layer into a DTCG token source compiled by a small inline Node script into an output-equivalent `instrument.css`, with a hardcoded-value gate and a CI check that `design-system.html` can't drift from the tokens — zero visual change, zero new dependencies.

**Architecture:** DTCG token JSON (primitive + semantic light/dark) → inline `build-tokens.mjs` (resolve aliases, emit CSS) → `instrument.css` (same `:root` / `[data-theme='dark']` / `@theme inline` as today) → Tailwind `--color-*` utilities → components.

**Tech Stack:** pnpm + turbo monorepo, `apps/web` (React 19, Tailwind v4), Node ESM scripts. **No new dependencies** — build, lint, and check are all small inline scripts (user decision, 2026-07-07).

## Global Constraints

- **Output-equivalence is the acceptance test:** after `tokens:build`, `apps/web/src/styles/instrument.css` must be byte-identical to its pre-refactor content (a one-time normalization commit is allowed if formatting alone differs). Verified by `git diff --exit-code`.
- Tiers are **primitive + semantic only** — no component-tier tokens, no new spacing/type/radius tokens beyond what `instrument.css` already defines.
- Raw hex lives ONLY in `primitives.tokens.json`. Semantic tokens alias primitives. Components reference semantic Tailwind utilities, never literals.
- Design source of record is `docs/design/design-system.html` (hand-authored). No Figma round-trip.
- **No new dependencies** — every gate is an inline Node ESM script under `apps/web/scripts/`.
- Source of truth for scope: `docs/superpowers/specs/2026-07-07-token-pipeline-design.md`.

## Token JSON shape (DTCG subset used here)

```json
// primitives.tokens.json — raw hex, named neutrally, deduped
{ "p": { "violet-600": { "$type": "color", "$value": "#4e46c6" },
         "violet-300": { "$type": "color", "$value": "#918aec" } } }
// semantic.light.tokens.json — --ins-* names aliasing primitives
{ "ins": { "accent": { "$type": "color", "$value": "{p.violet-600}" } } }
// semantic.dark.tokens.json — same names, dark aliases
{ "ins": { "accent": { "$type": "color", "$value": "{p.violet-300}" } } }
```
Alias syntax: `{group.name}` resolves to that token's `$value`. One alias level (semantic→primitive).

---

### Task 1: Inline token build script (stub build)

**Files:**
- Create: `apps/web/scripts/build-tokens.mjs`
- Create: `apps/web/src/styles/tokens/primitives.tokens.json` (stub: 2 tokens)
- Create: `apps/web/src/styles/tokens/semantic.light.tokens.json` (stub: 1 token)
- Create: `apps/web/src/styles/tokens/semantic.dark.tokens.json` (stub: 1 token)
- Modify: `apps/web/package.json` (add `"tokens:build"` script)

**Interfaces:**
- Produces: `tokens:build` command; `build-tokens.mjs` reads the three token files and writes CSS. Exported helper `emitInstrumentCss({light, dark})` for reuse by the check script in Task 5.

- [ ] **Step 1: Write stub token files.** `primitives.tokens.json`: `{"p":{"accent":{"$type":"color","$value":"#4e46c6"},"accent-dark":{"$type":"color","$value":"#918aec"}}}`. `semantic.light.tokens.json`: `{"ins":{"accent":{"$type":"color","$value":"{p.accent}"}}}`. `semantic.dark.tokens.json`: same name aliasing `{p.accent-dark}`.

- [ ] **Step 2: Write the build script.** `build-tokens.mjs` (Node ESM): read the 3 JSON files; flatten to `name→$value` maps; resolve `{alias}` refs against primitives; then emit one CSS string:
  - `:root {` + light `--ins-<name>: <value>;` lines + `}`
  - `[data-theme='dark'] {` + dark `--ins-<name>: <value>;` lines + `}`
  - `@theme inline {` + the static header (`--color-*: initial; --color-white:#ffffff; --color-black:#000000;`) + `--color-<name>: var(--ins-<name>);` per token + `}`
  Write to `apps/web/src/styles/instrument.generated.css` (Task 3 swaps the path). Factor the emit into an exported `emitInstrumentCss()`.

- [ ] **Step 3: Add script + run.** package.json: `"tokens:build": "node scripts/build-tokens.mjs"`. Run `pnpm --filter @tickets/web tokens:build`. Expected: `instrument.generated.css` contains `:root{--ins-accent:#4e46c6}`, `[data-theme='dark']{--ins-accent:#918aec}`, and `@theme inline{…--color-accent:var(--ins-accent)…}`.

- [ ] **Step 4: Commit**
  ```bash
  git add apps/web/scripts/build-tokens.mjs apps/web/src/styles/tokens apps/web/package.json apps/web/src/styles/instrument.generated.css
  git commit -m "feat(web): inline token build script with stub tokens"
  ```

---

### Task 2: Author full tokens; make build output-equivalent

**Files:**
- Modify: the three token JSON files (full set)
- Modify: `apps/web/scripts/build-tokens.mjs` (emit fidelity)
- Reference: `apps/web/src/styles/instrument.css` (the target output)

**Interfaces:**
- Consumes: `build-tokens.mjs` from Task 1.
- Produces: `instrument.generated.css` byte-identical to current `instrument.css` (plus the two intentional `on-danger` additions).

- [ ] **Step 1: Snapshot the target.** `cp apps/web/src/styles/instrument.css /tmp/instrument.target.css`.

- [ ] **Step 2: Author primitives.** For every distinct hex in `instrument.css` (both `:root` and `[data-theme='dark']` + the two shadows), add a primitive token. Dedupe identical hexes. Include `#2b0f0b` and `#ffffff` for the on-danger token below.

- [ ] **Step 3: Author semantic light + dark.** For every `--ins-*` name in `instrument.css`, add a same-named semantic token in light (aliasing the light primitive) and dark (aliasing the dark primitive). ADD one new semantic token `on-danger` (light → `#ffffff`, dark → `#2b0f0b`). Shadows (`shadow-sm`, `shadow-lg`) are emitted as raw string values matching the current CSS text exactly.

- [ ] **Step 4: Iterate to byte-equivalence.** Run `pnpm --filter @tickets/web tokens:build`, then `diff /tmp/instrument.target.css apps/web/src/styles/instrument.generated.css`. Adjust token order and the script's whitespace/quoting until the diff is EMPTY except the two intentional additions (`--ins-on-danger`, `--color-on-danger`). Formatting-only differences are resolved in Task 3.

- [ ] **Step 5: Determinism.** Build again; diff the two runs. Expected: identical.

- [ ] **Step 6: Commit**
  ```bash
  git add apps/web/src/styles/tokens apps/web/scripts/build-tokens.mjs apps/web/src/styles/instrument.generated.css
  git commit -m "feat(web): author full DTCG token set, build output-equivalent to instrument.css"
  ```

---

### Task 3: Swap generated file in; fix button.tsx; verify no visual change

**Files:**
- Modify: `apps/web/scripts/build-tokens.mjs` (output path → `instrument.css`)
- Replace (generated): `apps/web/src/styles/instrument.css`; delete `instrument.generated.css`
- Modify: `apps/web/src/ui/button.tsx:26`
- Modify: `apps/web/src/ui/switch.tsx` (comment reword)

**Interfaces:**
- Consumes: `on-danger` semantic token from Task 2.

- [ ] **Step 1: Point the build at the real path.** Change output to `apps/web/src/styles/instrument.css`; delete `instrument.generated.css`. Emit a top banner comment: `/* GENERATED by tokens:build — do not edit; edit src/styles/tokens/*.json */`. If the banner makes the diff non-empty vs the old file, that is the one-time normalization allowed by Global Constraints — commit it as the new baseline.

- [ ] **Step 2: Build.** `pnpm --filter @tickets/web tokens:build`. Confirm `instrument.css` carries `--ins-on-danger` / `--color-on-danger` and the banner, otherwise identical to pre-refactor.

- [ ] **Step 3: Fix button.tsx.** Replace the danger variant's `text-white dark:text-[#2b0f0b]` with `text-on-danger`. Confirm no `#` literal remains in the file.

- [ ] **Step 4: Reword switch.tsx comment.** Change the two comment lines containing `#fff` / `#2b0f0b` to name the tokens in words, so the Task 4 scan needn't parse comments.

- [ ] **Step 5: Visual-equivalence check.** Start dev web (`WEB_DEV_PORT=4620 pnpm --filter @tickets/web dev`, docker api up), open `http://localhost:4620/gallery`. Via chrome-devtools MCP `getComputedStyle`, record for BOTH themes: accent "New ticket" button bg, danger "Archive" button bg+color, "Blocked" kind badge bg+fg. Compare to the spec hexes (from `design-system.html`). Expected: identical.

- [ ] **Step 6: Commit**
  ```bash
  git add apps/web/scripts/build-tokens.mjs apps/web/src/styles/instrument.css apps/web/src/ui/button.tsx apps/web/src/ui/switch.tsx
  git commit -m "feat(web): generate instrument.css from tokens; tokenize danger button on-color"
  ```

---

### Task 4: Hardcoded-value gate (inline scan)

**Files:**
- Create: `apps/web/scripts/scan-hardcoded-values.mjs`
- Modify: `apps/web/package.json` (`"tokens:lint"` script)

**Interfaces:**
- Produces: `tokens:lint` — non-zero exit on any raw hex/rgb in components or hand-written CSS.

- [ ] **Step 1: Write the scan script.** `scan-hardcoded-values.mjs` (Node ESM, no dep) walks `apps/web/src/**/*.{ts,tsx,css}`, strips `//` and `/* */` comments, and fails on any `#[0-9a-fA-F]{3,8}` or `rgb(`/`hsl(` literal (catches Tailwind arbitrary values like `text-[#2b0f0b]` and `style={{color:'#...'}}`). Excludes `src/styles/tokens/**` and the generated `src/styles/instrument.css`. Prints `file:line` per hit; exit 1 if any.

- [ ] **Step 2: Wire + write the failing test.** package.json `"tokens:lint": "node scripts/scan-hardcoded-values.mjs"`. Temporarily add `text-[#123456]` to a scratch component; run `pnpm --filter @tickets/web tokens:lint`; expect FAIL naming that line.

- [ ] **Step 3: Confirm clean tree passes.** Remove the planted hex; run `tokens:lint`; expected PASS (button.tsx fixed in Task 3, switch.tsx comment reworded).

- [ ] **Step 4: Commit**
  ```bash
  git add apps/web/scripts/scan-hardcoded-values.mjs apps/web/package.json
  git commit -m "feat(web): tokens:lint — fail on hardcoded color values"
  ```

---

### Task 5: design-system.html ↔ tokens conformance check

**Files:**
- Create: `apps/web/scripts/check-design-tokens.mjs`
- Modify: `apps/web/package.json` (`"tokens:check"` script)

**Interfaces:**
- Consumes: `docs/design/design-system.html`, the token JSON (+ the resolver from `build-tokens.mjs` if useful).
- Produces: `tokens:check` — non-zero exit when a spec swatch value ≠ its token.

- [ ] **Step 1: Label→token map.** In the script: `{'bg.app':'app','surface.raised':'raised','surface.inset':'inset','border.hairline':'hairline','border.control':'control','text.primary':'ink','text.secondary':'ink-2','text.tertiary':'ink-3','accent':'accent','accent.hover':'accent-hover','accent.subtle':'accent-subtle','danger':'danger','danger.subtle':'danger-subtle'}`.

- [ ] **Step 2: Parse + compare.** Read `design-system.html`; in the "01 Color" section, from the LIGHT card and the DARK card, extract each swatch's label + `#RRGGBB` (regex over the swatch markup: name div followed by a hex div). For each mapped label, assert light-card hex == resolved light semantic token, dark-card hex == dark token. Collect all mismatches; exit non-zero listing `label: spec=#xxx token=#yyy`.

- [ ] **Step 3: Wire + failing test.** package.json `"tokens:check": "node scripts/check-design-tokens.mjs"`. Temporarily change one semantic token (light `accent`) to a wrong hex; run; expect FAIL naming `accent`; revert.

- [ ] **Step 4: Confirm conformance passes.** Run on real tokens; expected PASS. If a genuine spec-vs-token mismatch surfaces, STOP and report it — a finding, not a test to force green.

- [ ] **Step 5: Commit**
  ```bash
  git add apps/web/scripts/check-design-tokens.mjs apps/web/package.json
  git commit -m "feat(web): tokens:check — assert design-system.html matches tokens"
  ```

---

### Task 6: Aggregate gate + update adapter

**Files:**
- Modify: `apps/web/package.json` (`"tokens:verify"` aggregate)
- Modify: `.claude/skills/design-system-adapter.md`
- Modify: `turbo.json` / root scripts if a repo-wide check exists

**Interfaces:**
- Consumes: `tokens:build`, `tokens:lint`, `tokens:check`.

- [ ] **Step 1: Aggregate script.** `"tokens:verify": "node scripts/build-tokens.mjs && git diff --exit-code src/styles/instrument.css && node scripts/scan-hardcoded-values.mjs && node scripts/check-design-tokens.mjs"`. Run; expect PASS on a clean tree.

- [ ] **Step 2: Hook into checks.** If `turbo.json` / root has a `check`/CI aggregate, add `tokens:verify`; else document the command in the adapter.

- [ ] **Step 3: Update the adapter.** In `.claude/skills/design-system-adapter.md`, rewrite `tokenPipeline`: source = `apps/web/src/styles/tokens/*.tokens.json`; codegen = `pnpm --filter @tickets/web tokens:build` (emits `instrument.css`); gates = `tokens:lint` + `tokens:check`. Update `testCommands` to add `tokens:verify`. Remove BOTH "GAP" notes (no codegen / no lint gate).

- [ ] **Step 4: Full run.** `pnpm --filter @tickets/web tokens:verify` and `pnpm typecheck`; expected PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add apps/web/package.json turbo.json .claude/skills/design-system-adapter.md
  git commit -m "chore(web): aggregate tokens:verify gate + update design-system adapter"
  ```

---

## Self-Review

**Spec coverage:** DTCG source + build (Tasks 1-2), output-equivalence guardrail (Task 2 Step 4 + Task 3 Step 5), primitive+semantic tiers (Task 2), generated instrument.css (Task 3), no-hardcoded-values gate (Task 4), design-source CI check (Task 5), adapter update + wiring (Task 6). All spec sections mapped.

**Deviations from spec (flagged, user-approved 2026-07-07):** (1) build tool is an inline script, not Style Dictionary — the output is one bespoke file with a byte-equivalence requirement, which SD would need a custom format for anyway; inline gives full control with zero deps. (2) the hardcoded-value gate is an inline scan, not stylelint — stylelint cannot see hex inside Tailwind `className` arbitrary values (the one real offender, `button.tsx`). Net: zero new dependencies. (3) Only one real hardcoded-hex offender exists (button.tsx); switch.tsx is a comment.

**Type/name consistency:** token name `on-danger` / utility `text-on-danger` consistent across Tasks 2-3; script names `tokens:build|lint|check|verify` consistent across Tasks 1-6 and the adapter; `emitInstrumentCss()` produced in Task 1, reused in Task 5.
