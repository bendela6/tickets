---
name: mapping-component-states
description: Use before implementing or verifying a UI component, when enumerating which variants and states a component must cover, or when a component ships with states left untested.
---

## Overview

Coverage is the CARTESIAN PRODUCT of independent axes, not a happy-path list. A component isn't "done" because its default look works — it's done when every combination of variant, interaction state, content state, theme, and direction has been enumerated and rendered. The core rule: an unrendered state is an unverified state. The output of this skill is a machine-checkable manifest, and a missing cell must become a failing build, not a note for later.

## The recipe

1. Write the axes AS DATA (arrays): variants (kind/size/tone) × interaction states (default / hover / focus-visible / active / disabled) × content states (loading / error / empty / ideal / overflow / long-text) × theme × direction (LTR / RTL).
2. Mark which axes actually apply (a static badge has no hover/active; a button does). Drop N/A axes explicitly — don't just omit them silently.
3. Classify the component: PRESENTATIONAL (props in → output out, no behavior) or INTERACTIVE (has behavior). This decides which verification gates apply later (interactive components need the interaction-state axis exercised for real, not just styled).
4. Emit the coverage manifest: one entry per meaningful cell PLUS one side-by-side grid entry showing all cells at once. DERIVE cells by mapping over the axis arrays (never hand-duplicate) so adding one variant auto-expands coverage without editing the manifest by hand.

## Programmatic gate (definition of done)

The manifest IS the acceptance list. Every cell must become a rendered example in the project's component workbench (see the project adapter for where that lives and how examples are registered). A cell with no example is a failing build, never a human oversight — wire the manifest into whatever check enforces "every declared cell has a matching example" for this project.

## Red flags (each means STOP)

- Listing only happy-path variants; omitting focus-visible, disabled, loading, error, empty, overflow/long-text, or RTL
- Hand-writing N×M cases instead of deriving them from the axis arrays
- No side-by-side grid entry
- Skipping the presentational-vs-interactive classification
- Treating a missing example as acceptable ("nobody uses that state")
