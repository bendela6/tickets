# Design→Code Generic Skill Set — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build four generic, stack-agnostic design→code skills plus a per-project adapter, each pressure-tested before deployment.

**Architecture:** Skill bodies are 100% generic method; a per-project adapter file supplies stack specifics. Each skill is created RED→GREEN→REFACTOR per superpowers:writing-skills — baseline a fresh subagent WITHOUT the skill, write the skill to counter the observed failures, re-test WITH the skill, close loopholes.

**Tech Stack:** Markdown SKILL.md files under `.claude/skills/`. Testing is via subagent scenarios (writing-skills methodology), not a code test runner.

## Global Constraints

- Skill bodies name **no** framework, file, tool, or port — all specifics live in the adapter. (Verbatim from spec principle 5.)
- Tests assert observable outcomes only: role + accessible name + ARIA state, visible content, emitted events, focus, pixel diff. **Never** class names, DOM shape, internal state, snapshots. (Spec principle 2 + testing table.)
- Every visual value resolves to a **semantic** token; lint fails CI on any literal or wrong-tier token. (Spec principle 3.)
- Each skill = one responsibility, minimal unambiguous recipe. (Spec principle 4.)
- Skill descriptions follow writing-skills SDO: third person, start "Use when…", triggering conditions only, no workflow summary.
- Source of truth for all content: `docs/superpowers/specs/2026-07-07-design-to-code-skills-design.md`.

---

### Task 1: Project adapter template + this-repo instance

**Files:**
- Create: `.claude/skills/_adapter-template.md` (generic template with empty fields + field docs)
- Create: `.claude/skills/design-system-adapter.md` (this repo's filled instance)

**Interfaces:**
- Produces: the adapter contract — field names the four skills reference: `designSource`, `tokenPipeline`, `workbench`, `testCommands`, `componentConventions`, `knownTraps`.

- [ ] **Step 1: Write the retrieval scenario**
  Scenario for a subagent given ONLY `design-system-adapter.md`: "Where do tokens live, what command runs visual-regression tests, and what are this project's known styling traps?" Expected: answers all three from the file with no guessing.

- [ ] **Step 2: Write the template** with the six fields, each with a one-line doc of what goes in it (from spec "The project adapter (contract)").

- [ ] **Step 3: Write this repo's instance.** Fill from known facts: designSource = `docs/design/design-system.html` + `apps/web/src/styles/instrument.css`; tokenPipeline = `--ins-*` vars in instrument.css (no codegen yet — flag as gap); workbench = `/gallery` on dev web (`WEB_DEV_PORT=4620 pnpm --filter @tickets/web dev`); testCommands = `pnpm --filter @tickets/web test` (no visual/a11y runner yet — flag as gap); componentConventions = `apps/web/src/ui`, headless idiom = React hooks + radix-ui; knownTraps = preflight-off UA leakage, unlayered globals.css beating utilities, twMerge token collisions.

- [ ] **Step 4: Run the retrieval scenario** with a subagent. Expected: PASS (all three answered). If it guesses or misses, fix the field and re-run.

- [ ] **Step 5: Commit**
  ```bash
  git add .claude/skills/_adapter-template.md .claude/skills/design-system-adapter.md
  git commit -m "feat(skills): design-system adapter template + repo instance"
  ```

---

### Task 2: `tokenizing-the-design` skill

**Files:**
- Create: `.claude/skills/tokenizing-the-design/SKILL.md`

**Interfaces:**
- Consumes: adapter `tokenPipeline`, `designSource`.
- Produces: the three-tier token vocabulary (primitive→semantic→component) other skills assume.

- [ ] **Step 1: Write the application scenario**
  Give a subagent a small mock design (3 colors incl. a light/dark pair, 2 spacings, 1 radius) and: "Turn this into the token source of truth." No skill loaded.

- [ ] **Step 2: Run baseline WITHOUT skill.** Document failures verbatim (expected: hardcodes values, no primitive/semantic split, no theme-as-alias, hand-copies into code).

- [ ] **Step 3: Write the skill.** Frontmatter:
  ```yaml
  ---
  name: tokenizing-the-design
  description: Use when turning a design's values into a token source of truth, adding or changing design tokens, or when a value would otherwise be hardcoded in a component.
  ---
  ```
  Body = the spec's Skill 1 recipe verbatim (5 steps: extract+dedupe → three tiers → one machine-readable file with themes as re-pointed aliases → generate code from it → two lint gates) + programmatic gate + "extend, don't duplicate". Reference the adapter for the concrete token file + codegen + lint commands. No tool names in the body except as "per the adapter".

- [ ] **Step 4: Run the scenario WITH skill.** Expected: produces tiered tokens, aliased themes, zero literals, defers concrete commands to adapter.

- [ ] **Step 5: Refactor** — capture any new rationalization (e.g. "primitive is fine here") and add an explicit counter. Re-run until clean.

- [ ] **Step 6: Commit**
  ```bash
  git add .claude/skills/tokenizing-the-design/SKILL.md
  git commit -m "feat(skills): tokenizing-the-design"
  ```

---

### Task 3: `mapping-component-states` skill

**Files:**
- Create: `.claude/skills/mapping-component-states/SKILL.md`

**Interfaces:**
- Consumes: nothing (entry point per component).
- Produces: the coverage manifest (list of cells + one grid) that `implementing` renders and `verifying` checks.

- [ ] **Step 1: Write the application scenario**
  "Here is a Button design (primary/secondary/danger, 3 sizes, has hover/focus/disabled). Produce the list of states to build and verify." No skill loaded.

- [ ] **Step 2: Run baseline WITHOUT skill.** Document failures (expected: happy-path variants only; omits focus-visible, disabled, loading/error/empty/overflow, RTL, theme; no grid; no presentational-vs-interactive call).

- [ ] **Step 3: Write the skill.** Frontmatter:
  ```yaml
  ---
  name: mapping-component-states
  description: Use before implementing or verifying a UI component, when enumerating which variants and states a component must cover, or when a component ships with states left untested.
  ---
  ```
  Body = spec Skill 2 recipe verbatim (axes as data → mark which apply → classify presentational/interactive → emit manifest + grid) + gate "missing cell = failing build" + the derive-from-data rule (map arrays, no hand-duplication).

- [ ] **Step 4: Run WITH skill.** Expected: full matrix incl. content + interaction + theme/RTL axes, marks N/A axes, classifies the component, emits a grid entry.

- [ ] **Step 5: Refactor** loopholes; re-run until clean.

- [ ] **Step 6: Commit**
  ```bash
  git add .claude/skills/mapping-component-states/SKILL.md
  git commit -m "feat(skills): mapping-component-states"
  ```

---

### Task 4: `implementing-a-component` skill

**Files:**
- Create: `.claude/skills/implementing-a-component/SKILL.md`

**Interfaces:**
- Consumes: manifest from Task 3; semantic tokens from Task 2; adapter `componentConventions`.
- Produces: a component whose every manifest cell renders; consumed by Task 5.

- [ ] **Step 1: Write the pressure scenario**
  "Build a Badge with tones red/green/gray. Deadline pressure. The design shows the hexes right there." No skill loaded. (Tempts hardcoding + boolean props.)

- [ ] **Step 2: Run baseline WITHOUT skill.** Document failures (expected: hardcoded hexes, `isRed`/`isGreen` booleans, no variant config, no token reference).

- [ ] **Step 3: Write the skill.** Frontmatter:
  ```yaml
  ---
  name: implementing-a-component
  description: Use when building or changing a UI component from a design, before writing component code, or when adding a variant — enforces token-only values, variant configs, and behavior/presentation separation.
  ---
  ```
  Body = spec Skill 3 recipe verbatim (brain/looks split → declarative variant config, tokens only → one enumerated prop over many booleans → compose don't configure + polymorphism → uncontrolled default / opt-in controlled → render every manifest cell) + gate (token lint + variant types + smoke) + the clean-code invariants table.

- [ ] **Step 4: Run WITH skill.** Expected: `tone` union prop, variant config, values via semantic tokens, no literals, renders all cells.

- [ ] **Step 5: Refactor** loopholes; re-run until clean.

- [ ] **Step 6: Commit**
  ```bash
  git add .claude/skills/implementing-a-component/SKILL.md
  git commit -m "feat(skills): implementing-a-component"
  ```

---

### Task 5: `verifying-a-component` skill

**Files:**
- Create: `.claude/skills/verifying-a-component/SKILL.md`

**Interfaces:**
- Consumes: manifest (Task 3), adapter `testCommands` + `designSource` baseline.
- Produces: the pass/fail gate (behavior + a11y + visual).

- [ ] **Step 1: Write the pressure scenario**
  "Quick — verify this Switch, I ship in 5 min. Screenshot looks fine. Here's a test that checks `expect(el).toHaveClass('bg-accent')`." No skill loaded. (Tempts class-name assertions + screenshot verdict + skipping states.)

- [ ] **Step 2: Run baseline WITHOUT skill.** Document failures (expected: accepts the class-name test, passes on screenshot, skips keyboard/focus + light theme).

- [ ] **Step 3: Write the skill.** Frontmatter:
  ```yaml
  ---
  name: verifying-a-component
  description: Use when checking a UI component matches its design and works, before claiming a component done, or when a test asserts CSS classes / DOM shape instead of observable behavior.
  ---
  ```
  Body = spec Skill 4 recipe verbatim (universal: role+name+state assertions incl. negative branch → axe gate with incomplete-queue → pinned visual diff vs design-bound baseline via modes; interactive-adds: driven keyboard/focus/emitted events) + definition of done + refactor-proof litmus + the assert/never-assert table.

- [ ] **Step 4: Run WITH skill.** Expected: rejects the class-name test and rewrites it as role/state, refuses the screenshot verdict, enumerates uncovered states as failures, adds keyboard/focus for the interactive Switch.

- [ ] **Step 5: Refactor** loopholes; re-run until clean.

- [ ] **Step 6: Commit**
  ```bash
  git add .claude/skills/verifying-a-component/SKILL.md
  git commit -m "feat(skills): verifying-a-component"
  ```

---

### Task 6: Reconcile superseded skills + update index

**Files:**
- Delete: `.claude/skills/implementing-from-design/SKILL.md`, `.claude/skills/verifying-against-design/SKILL.md` (superseded by the generic set; their project-specific traps now live in the adapter).
- Modify: `CLAUDE.md` (skill index section)
- Keep: `running-the-stack`, `migrating-legacy-screens`, `syncing-design` (legitimately project-bound; referenced from adapter).

**Interfaces:**
- Consumes: all skills from Tasks 1-5.

- [ ] **Step 1: Verify no dangling references.** Grep `.claude/` and `CLAUDE.md` for `implementing-from-design` and `verifying-against-design`. Expected: only the files being deleted + CLAUDE.md index.

- [ ] **Step 2: Delete the two superseded skill dirs.**

- [ ] **Step 3: Update `CLAUDE.md`** skill index to list the four generic skills + adapter, and note the three project-specific ops skills. Confirm the adapter's `knownTraps` still carries the preflight/globals/twMerge traps that were in the deleted skills (no knowledge lost).

- [ ] **Step 4: Verify** — grep again; expected zero references to the deleted skill names outside git history.

- [ ] **Step 5: Commit**
  ```bash
  git add -A .claude/skills CLAUDE.md
  git commit -m "refactor(skills): supersede project-specific design skills with generic set"
  ```

---

## Self-Review

**Spec coverage:** tokenizing (Task 2), state matrix (Task 3), implementing (Task 4), verifying (Task 5), adapter contract (Task 1), reconciliation of old skills (Task 6), branch presentational/interactive (in Tasks 3+5), testing table (Task 5), definition of done (Task 5). All spec sections mapped.

**Placeholder scan:** the two "flag as gap" notes in Task 1 (no codegen / no visual+a11y runner yet) are intentional, honest adapter entries, not plan placeholders — they name follow-on setup work explicitly rather than hiding it.

**Type consistency:** adapter field names (`designSource`, `tokenPipeline`, `workbench`, `testCommands`, `componentConventions`, `knownTraps`) are used identically in Tasks 1–5. Skill names are stable across tasks and the CLAUDE.md index.

## Known follow-on (out of scope for this plan)

The adapter will honestly record two capability gaps in this repo: no token codegen pipeline, and no visual-regression / a11y test runner wired up. Building those is a separate plan — the skills are generic and ready; the repo's adapter just points at them once they exist.
