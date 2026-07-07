# Design → Code Skill Set (generic) — Design

**Status:** approved architecture, pending spec review
**Date:** 2026-07-07

## Goal

A reusable, stack-agnostic set of agent skills for turning a visual design into
production UI code, where "correct" is proven **programmatically** and tests
assert what a **user observes**, never how the code is built. The set is generic;
one thin per-project **adapter** supplies all stack specifics.

## Governing principles (the requirements, distilled)

1. **The design is an executable artifact.** It is expressed as machine-readable
   tokens plus design-bound visual baselines. Implementation and verification
   both derive from it, so "code matches design" is true by construction and by
   machine check — not by eye.
2. **Assert observable outcomes, never implementation details.** Query by ARIA
   role + accessible name + state, and visible content. Never assert CSS class
   names, DOM structure, internal state, or serialized snapshots.
3. **No hardcoded values.** Every visual value resolves to a *semantic* token;
   a lint gate fails CI on any literal or wrong-tier token.
4. **Single responsibility, minimal steps.** Four skills, one job each, each a
   short unambiguous recipe so the agent does not improvise (hallucinate).
5. **Generic method, project adapter.** Skill bodies name no framework, file, or
   tool. The adapter names them all.

## The presentational / interactive branch (resolves "behavioral testing of no-logic components")

There are two component kinds with two definitions of "correct":

- **Presentational** (badge, chip, card, avatar): no behavior. Correctness =
  **appearance** (visual regression) + **meaning** (a11y role/name/state, and the
  right content for given props). Its "behavior" is the props-in → observable-
  output-out contract; test that, not interactions.
- **Interactive** (dropdown, switch, date picker): has behavior. Correctness =
  everything above **+ driven behavior** (keyboard reachability, tab order,
  activation keys, focus trap/restore, emitted events).

Every skill checks this classification first; it decides which gates apply.

## Architecture: four skills + one adapter

```
tokenizing-the-design      (once per system, extended per new value)
        │
        ▼   for each component:
mapping-component-states  →  implementing-a-component  →  verifying-a-component
        └──────────────── all read the project adapter ────────────────┘
```

---

## Skill 1 — `tokenizing-the-design`

**Responsibility:** establish/extend the token source of truth so every design
value has a semantic name and code is generated from it.

**Recipe (minimal):**
1. Extract every distinct value from the design (color, space, size, radius,
   type, shadow, duration); deduplicate.
2. Structure into three tiers: **primitive** (raw value) → **semantic** (intent,
   via alias) → **component** (specific usage). Aliases, never repeated values.
3. Author as one machine-readable token file (DTCG-style). Themes (light/dark/
   high-contrast) are the *same semantic names re-pointed* to different
   primitives — a data change, not a code change.
4. Generate the code artifacts from the token file with a build step (per the
   adapter). Never hand-copy a value into code.
5. Turn on two lint gates: (a) forbid any literal in themeable properties;
   (b) forbid primitive tokens inside components (semantic-only).

**Programmatic gate / done:** token file schema-validates; all references
resolve; lint is red on any literal or wrong-tier token; (optional) build-time
WCAG-contrast assertion on explicit `on-*` pairs. **Extend, don't duplicate:** a
new value is a new semantic token or alias.

---

## Skill 2 — `mapping-component-states`

**Responsibility:** enumerate the full state matrix *as data* before
implementing, so nothing ships silently unverified.

**Recipe:**
1. Write the axes as data arrays: variants × interaction states
   (default / hover / focus-visible / active / disabled) × content states
   (loading / error / empty / ideal / overflow / long-text) × theme × direction.
2. Mark which axes apply (a static badge has no hover/active; a button does).
3. Classify the component: presentational or interactive (sets the gates).
4. Emit the **coverage manifest**: one entry per meaningful cell **+** one
   side-by-side grid entry. Derive cells by mapping over the arrays so adding a
   variant expands coverage automatically (no hand-duplication).

**Programmatic gate / done:** the manifest is the acceptance list. Every cell
must become a rendered example in the workbench; a missing cell is a failing
build, never a human oversight.

---

## Skill 3 — `implementing-a-component`

**Responsibility:** build the component to spec with clean-code structure.

**Recipe:**
1. **Split brain from looks.** If interactive, put state + handlers + ARIA in a
   headless layer (hook / composable / builder per adapter) that returns state,
   handlers, and a11y attributes; presentation only renders them. Pure-
   presentational components skip this.
2. **Model all styling as a declarative variant config**; every value resolves
   to a semantic token — zero literals.
3. **One enumerated prop beats many booleans.** Collapse mutually-exclusive
   booleans into a single `variant` union; keep the prop surface small and
   orthogonal.
4. **Compose, don't configure.** Prefer composable named parts sharing implicit
   context over a mega-props API; make elements polymorphic (`as`/`asChild`)
   instead of wrapper triplication.
5. **State ownership is a spectrum.** Default uncontrolled; accept optional
   `value`/`onChange` for controlled; escalate to state-reducer/control-props
   only on a real need.
6. Render every manifest cell in the workbench.

**Programmatic gate / done:** token lint passes; variant config type-checks;
every manifest cell renders without error (smoke test).

---

## Skill 4 — `verifying-a-component`

**Responsibility:** prove the component behaves correctly and matches the design,
through observable outcomes only.

**Recipe — universal (every component):**
1. **Semantic/behavioral:** query by role + accessible name; for each variant and
   each conditional branch, assert the visible output — and assert the *other*
   branch is absent (both paths covered). Assert ARIA state
   (disabled/pressed/expanded/selected). Never assert class names or DOM shape.
2. **Accessibility gate:** run axe on each state; fail on new violations; route
   axe "incomplete" results to a listed manual-review queue.
3. **Visual match:** snapshot each state in a pinned environment (fonts loaded,
   animations off, fixed viewport + DPR; pseudo-states forced) and pixel-diff
   against the **design-bound baseline** (bound to the design source, not merely
   the previous commit). Fan out theme/RTL/viewport via *modes*, not duplicated
   cases.

**Recipe — interactive only (add):**
4. **Driven behavior** (real browser / user-event): keyboard reachability, tab
   order matches visual order, Enter/Space (or arrows) activate, focus trap +
   restore for overlays; assert `activeElement` and emitted callbacks (mocked).

**Programmatic gate / done:** all manifest cells covered; behavior + a11y +
visual green; interactive components keyboard-operable. Any uncovered cell fails.
**Refactor-proof litmus:** a correct test breaks only when user-facing behavior
or output changes — not on renamed handlers, restructured DOM, or swapped styles.

---

## The project adapter (contract)

A single per-project file the skills read. It is the *only* place stack
specifics live. Required fields:

- **Design source of record** — the token file + the design reference for
  baselines (e.g. exported design doc, Figma frames).
- **Token pipeline** — token file path/format; the codegen command; the lint
  commands for the two gates.
- **Component workbench** — how to render one component state in isolation; the
  command to run it.
- **Test commands** — behavioral runner, a11y scan, visual-regression run +
  baseline-update command.
- **Component conventions** — where components live, headless-layer idiom
  (hook/composable/builder), variant-config tool.
- **Known traps** — project-specific gotchas (the current repo's examples:
  preflight-off UA leakage, unlayered legacy CSS beating utilities, twMerge
  token collisions).

Existing project-specific skills (`running-the-stack`, `migrating-legacy-
screens`, `syncing-design`) are legitimately project-bound and are referenced
from the adapter rather than genericized.

## Testing philosophy — what we assert / never assert

| Assert (observable) | Never assert (implementation) |
|---|---|
| Role + accessible name | CSS class names |
| Visible text / content per props | DOM structure / nesting / order |
| ARIA state (disabled/pressed/expanded/…) | Internal component state |
| Emitted events (mocked callbacks) | Event-handler names |
| Focus position (`activeElement`) | Serialized DOM snapshots |
| Pixel diff vs design-bound baseline | Exact style values inline in unit tests |

## What programmatic verification buys us

- **No-hardcoded-values** is enforced by lint, not convention.
- **Design match** is a pixel diff against a baseline bound to the design source.
- **Meaning/behavior** is the a11y tree — the one contract that survives refactors.
- **Coverage** is machine-checked: an unrendered state is a red build.
- **Accessibility** is a CI gate (~57% automated) + an explicit manual queue for
  the judgment-based remainder.

## Definition of done (per component)

A story/example exists for every matrix cell + a grid; behavior asserted via
role/name/state; a11y gate passes (known exceptions downgraded explicitly, not
deleted); visual baseline approved across theme/viewport/RTL modes; interactive
components keyboard-operable with visible focus and correct ARIA. "Done" is this
checklist, not a judgment call.

## Non-goals

- Not tied to React/Tailwind/this repo (those live in the adapter).
- Not a visual-judgment ("looks right") process anywhere.
- No class-name / snapshot / internal-state tests.
```
