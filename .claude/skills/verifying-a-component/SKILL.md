---
name: verifying-a-component
description: Use when checking a UI component matches its design and works, before claiming a component done, or when a test asserts CSS classes or DOM shape instead of observable behavior.
---

## Overview

Verification is measurement of OBSERVABLE OUTCOMES, never inspection of how the code is built. Appearance is proven by pixels, meaning by the accessibility tree, behavior only where behavior exists. Never assert class names, DOM shape, internal state, or serialized snapshots.

## The recipe — universal (every component):

1. Semantic/behavioral: query by ROLE + ACCESSIBLE NAME. For each variant and each conditional branch, assert the visible output — AND assert the other branch is ABSENT (both paths covered). Assert ARIA state (disabled / pressed / expanded / selected). Never assert class names or DOM structure.
2. Accessibility gate: run an automated a11y engine (per adapter) on each state; fail on new violations; route "incomplete/needs-review" results to a listed manual-review queue (automated a11y is a floor ~57%, not a ceiling).
3. Visual match: snapshot each state in a PINNED environment (fonts loaded, animations off, fixed viewport + device-pixel-ratio; pseudo-states forced) and pixel-diff against the DESIGN-BOUND baseline (bound to the design source, not merely the previous commit). Fan out theme / RTL / viewport via "modes", not duplicated cases.

## The recipe — interactive components only (add):

4. Drive real interaction (real browser / user-event, per adapter): keyboard reachability, tab order matches visual order, Enter/Space (or arrows) activate, focus trap + restore for overlays. Assert `activeElement` and emitted callbacks (mocked). Note: a11y engines do NOT catch keyboard/focus bugs — these must be driven.

## Programmatic gate (definition of done)

Every manifest cell covered; behavior + a11y + visual all green; interactive components keyboard-operable. Any uncovered manifest cell FAILS the run (a missing measurement is a result, never a skip).

## Refactor-proof litmus

A correct test breaks ONLY when user-facing behavior or output changes — not when a handler is renamed, the DOM restructured, or styles swapped. If a plausible harmless refactor would break the test, it asserts an implementation detail — rewrite it.

## Assert / Never-assert (quick-reference table)

ASSERT (observable): role + accessible name · visible content for given props · ARIA state (disabled/pressed/expanded/…) · emitted events (mocked callbacks) · focus position (activeElement) · pixel diff vs design-bound baseline.

NEVER ASSERT (implementation): CSS class names · DOM structure / nesting / order · internal component state · event-handler names · serialized DOM snapshots · exact style values inline in unit tests.

## Red flags (each means STOP)

- A test that asserts a CSS class or DOM structure
- Declaring "matches design" from a screenshot glance instead of a pixel diff
- Marking a component done with manifest cells left unmeasured
- Pixel-diffing against last commit instead of a design-bound baseline
- Skipping keyboard/focus tests on an interactive component
