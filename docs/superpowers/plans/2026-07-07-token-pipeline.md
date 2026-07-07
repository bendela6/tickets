# Design Token Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the hand-authored `--ins-*` token layer into a DTCG token source compiled by Style Dictionary into an output-equivalent `instrument.css`, with a hardcoded-value gate and a CI check that `design-system.html` can't drift from the tokens — zero visual change.

**Architecture:** DTCG token JSON (primitive + semantic light/dark) → Style Dictionary v4 custom CSS format → `instrument.css` (same `:root` / `[data-theme='dark']` / `@theme inline` as today) → Tailwind `--color-*` utilities → components.

**Tech Stack:** pnpm + turbo monorepo, `apps/web` (React 19, Tailwind v4 via vite plugin), Node ESM scripts. New dep: `style-dictionary` v4 (+ `stylelint` + `stylelint-declaration-strict-value` for the small CSS surface).

## Global Constraints

- **Output-equivalence is the acceptance test:** after `tokens:build`, `apps/web/src/styles/instrument.css` must be byte-identical to its pre-refactor content (a one-time normalization commit is allowed if formatting alone differs). Verified by `git diff --exit-code`.
- Tiers are **primitive + semantic only** — no component-tier tokens, no new spacing/type/radius tokens beyond what `instrument.css` already defines.
- Raw hex lives ONLY in `primitives.tokens.json`. Semantic tokens alias primitives. Components reference semantic Tailwind utilities, never literals.
- Design source of record is `docs/design/design-system.html` (hand-authored). No Figma round-trip.
- New dependencies go through the **add-package** skill (user approval) before install.
- Source of truth for scope: `docs/superpowers/specs/2026-07-07-token-pipeline-design.md`.

---

### Task 1: Scaffold Style Dictionary + custom CSS format (stub build)

**Files:**
- Create: `apps/web/style-dictionary.config.js`
- Create: `apps/web/src/styles/tokens/primitives.tokens.json` (stub: 2 tokens)
- Create: `apps/web/src/styles/tokens/semantic.light.tokens.json` (stub: 1 token)
- Create: `apps/web/src/styles/tokens/semantic.dark.tokens.json` (stub: 1 token)
- Modify: `apps/web/package.json` (add `"tokens:build"` script)

**Interfaces:**
- Produces: `tokens:build` command; a custom SD format named `css/instrument` that emits `:root{…}`, `[data-theme='dark']{…}`, and `@theme inline{…}` blocks.

- [ ] **Step 1: Add the dependency.** Use the add-package skill to add `style-dictionary` (v4) to `apps/web` devDependencies. Await approval + install.

- [ ] **Step 2: Write stub token files.** `primitives.tokens.json` with two DTCG color tokens (e.g. `{"color":{"accent-1":{"$type":"color","$value":"#4e46c6"},"accent-1-dark":{"$type":"color","$value":"#918aec"}}}`). `semantic.light.tokens.json`: `{"ins":{"accent":{"$type":"color","$value":"{color.accent-1}"}}}`. `semantic.dark.tokens.json`: same name aliasing `{color.accent-1-dark}`.

- [ ] **Step 3: Write the SD config + custom format.** `style-dictionary.config.js` builds twice (light source = primitives+semantic.light, dark source = primitives+semantic.dark) and a custom `css/instrument` format assembles one file: light `--ins-*` under `:root`, dark `--ins-*` under `[data-theme='dark']`, then an `@theme inline` block emitting `--color-<name>: var(--ins-<name>)` for every token plus the static `--color-*: initial; --color-white:#ffffff; --color-black:#000000;` header. Output path `apps/web/src/styles/instrument.generated.css` for now (Task 3 swaps it in).

- [ ] **Step 4: Add script + run it.** package.json: `"tokens:build": "node --experimental-vm-modules ./node_modules/style-dictionary/... "` (or a small `build-tokens.mjs` that imports SD and runs). Run `pnpm --filter @tickets/web tokens:build`. Expected: `instrument.generated.css` contains `:root{--ins-accent:#4e46c6}`, `[data-theme='dark']{--ins-accent:#918aec}`, and `@theme inline{…--color-accent:var(--ins-accent)…}`.

- [ ] **Step 5: Commit**
  ```bash
  git add apps/web/style-dictionary.config.js apps/web/src/styles/tokens apps/web/package.json apps/web/src/styles/instrument.generated.css
  git commit -m "feat(web): scaffold Style Dictionary token build with custom CSS format"
  ```

---

### Task 2: Author full tokens; make build output-equivalent

**Files:**
- Modify: the three token JSON files (full set)
- Modify: `apps/web/style-dictionary.config.js` (format fidelity)
- Reference: `apps/web/src/styles/instrument.css` (the target output)

**Interfaces:**
- Consumes: the `css/instrument` format from Task 1.
- Produces: `instrument.generated.css` byte-identical to current `instrument.css`.

- [ ] **Step 1: Snapshot the target.** `cp apps/web/src/styles/instrument.css /tmp/instrument.target.css` (reference for diffing).

- [ ] **Step 2: Author primitives.** For every distinct hex in `instrument.css` (both `:root` and `[data-theme='dark']` blocks + the two shadows), add a primitive token in `primitives.tokens.json`. Dedupe identical hexes to one primitive. Include the danger button's dark text `#2b0f0b` and light `#ffffff` (for the new on-danger token below).

- [ ] **Step 3: Author semantic light + dark.** For every `--ins-*` name in `instrument.css`, add a semantic token of the same name in `semantic.light.tokens.json` (aliasing the light primitive) and `semantic.dark.tokens.json` (aliasing the dark primitive). ADD one new semantic token `on-danger` (light → white primitive, dark → `#2b0f0b` primitive) — Task 3 consumes it. Shadows (`shadow-sm`, `shadow-lg`) are `$type:"shadow"` or emitted as raw strings via the format; match the current CSS text exactly.

- [ ] **Step 4: Iterate the format to byte-equivalence.** Run `pnpm --filter @tickets/web tokens:build`, then `diff /tmp/instrument.target.css apps/web/src/styles/instrument.generated.css`. Adjust token order and the format's whitespace/quoting until the diff is EMPTY except for the two intentional additions (`--ins-on-danger` + `--color-on-danger`). If only formatting differs, that is resolved in Task 3.

- [ ] **Step 5: Run to confirm determinism.** Build again; diff again. Expected: no change between runs.

- [ ] **Step 6: Commit**
  ```bash
  git add apps/web/src/styles/tokens apps/web/style-dictionary.config.js apps/web/src/styles/instrument.generated.css
  git commit -m "feat(web): author full DTCG token set, build output-equivalent to instrument.css"
  ```

---

### Task 3: Swap generated file in; fix button.tsx; verify no visual change

**Files:**
- Delete: `apps/web/src/styles/instrument.css` (hand-authored) → replaced by generated output at the same path
- Modify: `apps/web/style-dictionary.config.js` (output path → `instrument.css`)
- Modify: `apps/web/src/ui/button.tsx:26`
- Modify: `apps/web/src/ui/switch.tsx` (comment reword)

**Interfaces:**
- Consumes: `on-danger` semantic token from Task 2.

- [ ] **Step 1: Point the build at the real path.** Change SD output to `apps/web/src/styles/instrument.css`; delete `instrument.generated.css`. Add a top-of-file banner comment in the format: `/* GENERATED by tokens:build — do not edit; edit src/styles/tokens/*.json */`. (If the banner makes the diff non-empty vs the old file, that is the one-time normalization allowed by Global Constraints — commit it as the new baseline.)

- [ ] **Step 2: Build.** `pnpm --filter @tickets/web tokens:build`. Confirm `instrument.css` now carries `--ins-on-danger` / `--color-on-danger` and the banner, and is otherwise identical to the pre-refactor file.

- [ ] **Step 3: Fix button.tsx.** Replace the danger variant's `text-white dark:text-[#2b0f0b]` with `text-on-danger` (single theme-switched token). Verify no `#` literal remains in the file.

- [ ] **Step 4: Reword switch.tsx comment.** Change the two comment lines that contain `#fff` / `#2b0f0b` to name the tokens in words (e.g. "white (light) / app (dark)") so the hex-scan gate in Task 4 needn't parse comments.

- [ ] **Step 5: Visual-equivalence check.** Start dev web (`WEB_DEV_PORT=4620 pnpm --filter @tickets/web dev`, docker api up), open `http://localhost:4620/gallery`. Via chrome-devtools MCP `getComputedStyle`, record for BOTH themes: the accent "New ticket" button bg, the danger "Archive" button bg+color, and the "Blocked" kind badge bg+fg. Compare against the same measurements taken before Step 1 (or against the spec hexes). Expected: identical.

- [ ] **Step 6: Commit**
  ```bash
  git add apps/web/style-dictionary.config.js apps/web/src/styles/instrument.css apps/web/src/ui/button.tsx apps/web/src/ui/switch.tsx
  git commit -m "feat(web): generate instrument.css from tokens; tokenize danger button on-color"
  ```

---

### Task 4: Hardcoded-value gate

**Files:**
- Create: `apps/web/scripts/scan-hardcoded-values.mjs`
- Create: `apps/web/.stylelintrc.json` (+ dep) — for `.css` only
- Modify: `apps/web/package.json` (`"tokens:lint"` script)

**Interfaces:**
- Produces: `tokens:lint` — non-zero exit on any raw hex/rgb in components or hand-written CSS.

- [ ] **Step 1: Write the scan script.** `scan-hardcoded-values.mjs` walks `apps/web/src/**/*.{ts,tsx}`, strips `//` and `/* */` comments, and fails on any `#[0-9a-fA-F]{3,8}` or `rgb(`/`hsl(` literal (this catches Tailwind arbitrary values like `text-[#2b0f0b]` and `style={{color:'#...'}}`). Excludes `src/styles/tokens/**` and the generated `instrument.css`. Prints `file:line` for each hit.

- [ ] **Step 2: Add stylelint for CSS (small surface).** Add `stylelint` + `stylelint-declaration-strict-value` via add-package. `.stylelintrc.json` requires color/px properties to be a var/function in any hand-written `.css`; ignore `instrument.css` (generated) and token JSON. If no hand-written CSS remains, this is a thin guard against future regressions.

- [ ] **Step 3: Wire the script + write the failing test.** package.json `"tokens:lint": "node apps/web/scripts/scan-hardcoded-values.mjs && stylelint 'apps/web/src/**/*.css'"`. Temporarily add `text-[#123456]` to a scratch spot in a test component; run `pnpm --filter @tickets/web tokens:lint`; expect FAIL naming that line.

- [ ] **Step 4: Confirm clean tree passes.** Remove the planted hex; run `tokens:lint`; expected PASS (button.tsx already fixed in Task 3).

- [ ] **Step 5: Commit**
  ```bash
  git add apps/web/scripts/scan-hardcoded-values.mjs apps/web/.stylelintrc.json apps/web/package.json
  git commit -m "feat(web): tokens:lint — fail CI on hardcoded color values"
  ```

---

### Task 5: design-system.html ↔ tokens conformance check

**Files:**
- Create: `apps/web/scripts/check-design-tokens.mjs`
- Modify: `apps/web/package.json` (`"tokens:check"` script)

**Interfaces:**
- Consumes: `docs/design/design-system.html`, the token JSON.
- Produces: `tokens:check` — non-zero exit when a spec swatch value ≠ its token.

- [ ] **Step 1: Write the label→token map.** In the script, map the design-system.html swatch labels to token names, e.g. `{'bg.app':'app','surface.raised':'raised','surface.inset':'inset','border.hairline':'hairline','border.control':'control','text.primary':'ink','text.secondary':'ink-2','text.tertiary':'ink-3','accent':'accent','accent.hover':'accent-hover','accent.subtle':'accent-subtle','danger':'danger','danger.subtle':'danger-subtle'}`.

- [ ] **Step 2: Parse + compare.** Read `design-system.html`; in the "01 Color" section extract, from the LIGHT card and the DARK card, each swatch's label + hex (regex over the swatch markup: a name div followed by a `#RRGGBB` div). For each mapped label, assert the light-card hex equals the light semantic token's resolved value and the dark-card hex equals the dark token's. Collect all mismatches; exit non-zero listing `label: spec=#xxx token=#yyy`.

- [ ] **Step 3: Wire + write the failing test.** package.json `"tokens:check": "node apps/web/scripts/check-design-tokens.mjs"`. Temporarily change one semantic token (e.g. light `accent`) to a wrong hex; run `pnpm --filter @tickets/web tokens:check`; expect FAIL naming `accent`. Revert.

- [ ] **Step 4: Confirm conformance passes.** Run `tokens:check` on the real tokens; expected PASS. If a real mismatch surfaces (spec vs code genuinely differ), STOP and report it — that is a finding, not a test to force green.

- [ ] **Step 5: Commit**
  ```bash
  git add apps/web/scripts/check-design-tokens.mjs apps/web/package.json
  git commit -m "feat(web): tokens:check — assert design-system.html matches tokens"
  ```

---

### Task 6: Wire gates + update adapter

**Files:**
- Modify: `apps/web/package.json` (a `tokens:verify` aggregate + hook into repo checks)
- Modify: `.claude/skills/design-system-adapter.md`
- Modify: root `package.json` or `turbo.json` if a repo-wide `check` exists

**Interfaces:**
- Consumes: `tokens:build`, `tokens:lint`, `tokens:check`.

- [ ] **Step 1: Aggregate script.** Add `"tokens:verify"` running build-then-diff-clean (`tokens:build && git diff --exit-code apps/web/src/styles/instrument.css`), then `tokens:lint`, then `tokens:check`. Run it; expect PASS on a clean tree.

- [ ] **Step 2: Hook into the check flow.** If a repo `check`/CI aggregate exists (per `turbo.json` / root scripts), add `tokens:verify`. Otherwise document the command in the adapter.

- [ ] **Step 3: Update the adapter.** In `.claude/skills/design-system-adapter.md`, rewrite `tokenPipeline` to: source = `apps/web/src/styles/tokens/*.tokens.json`; codegen = `pnpm --filter @tickets/web tokens:build` (emits `instrument.css`); gates = `tokens:lint` (no hardcoded values) + `tokens:check` (spec conformance). Update `testCommands` to add `tokens:verify`. Remove BOTH "GAP" notes about no codegen / no lint gate.

- [ ] **Step 4: Full run.** `pnpm --filter @tickets/web tokens:verify` and `pnpm typecheck`; expect PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add apps/web/package.json turbo.json .claude/skills/design-system-adapter.md
  git commit -m "chore(web): aggregate tokens:verify gate + update design-system adapter"
  ```

---

## Self-Review

**Spec coverage:** DTCG source + SD build (Tasks 1-2), output-equivalence guardrail (Task 2 Step 4 + Task 3 Step 5), primitive+semantic tiers (Task 2), generated instrument.css (Task 3), no-hardcoded-values gate (Task 4), design-source CI check (Task 5), adapter update + wiring (Task 6). All spec sections mapped.

**Placeholder scan:** the SD `tokens:build` invocation in Task 1 Step 4 is left as "SD import or CLI" — the implementer picks the concrete form when the package is installed and its v4 API is in front of them; the acceptance (emitted CSS shape) is exact. No other placeholders.

**Deviations from spec (flagged):** (1) the spec's "ESLint rule forbidding raw hex in .tsx" is implemented as a custom scan script because stylelint/ESLint-CSS rules cannot see hex inside Tailwind `className` arbitrary values; stylelint is retained only for `.css`. (2) Only one real hardcoded-hex offender exists (button.tsx); switch.tsx is a comment.

**Type/name consistency:** token name `on-danger` / utility `text-on-danger` used consistently across Tasks 2-3; script names `tokens:build|lint|check|verify` consistent across Tasks 1-6 and the adapter.
