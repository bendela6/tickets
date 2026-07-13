---
name: implementing-a-component
description: Use when building or changing a UI component from a design, before writing component code, or when adding a variant to an existing component.
---

## Overview

Build to the design with clean-code structure so the component is dynamic, non-repetitive, single-responsibility, and extensible. Every visual value is a semantic token; every visual variation is a declarative variant.

## The recipe

1. Split brain from looks: if the component has behavior, put state + event handlers + accessibility attributes in a headless layer (the adapter names the idiom — hook/composable/builder) that returns them; the presentation layer only renders what it's given. Pure-presentational components skip this.
2. Model ALL styling as a declarative variant config (per the adapter's variant tool); every value resolves to a SEMANTIC token — zero literals.
3. One enumerated prop beats many booleans: collapse mutually-exclusive booleans (isPrimary/isDanger) into a single `variant` union. Keep the prop surface small and orthogonal — every prop meaningful in every state.
4. Compose, don't configure: prefer composable named parts sharing implicit context over an ever-growing prop list; make elements polymorphic (a slot or polymorphic-element mechanism the adapter names) instead of duplicating wrapper components per element type.
5. State ownership is a spectrum: default UNCONTROLLED (owns its state); accept optional value/onChange to become CONTROLLED; escalate to a state-reducer or control props only when a real need (transition override, cross-component sync) demands it.
6. Render every cell from the coverage manifest (from the mapping-component-states skill) in the workbench.

## Programmatic gate (definition of done)

Token lint passes (no literals, no primitive tokens in the component); the variant config type-checks; every manifest cell renders without error (smoke test).

## Red flags (each means STOP)

- A hardcoded hex/px/number anywhere in the component
- Multiple booleans for one concern (isPrimary + isDanger) instead of one enumerated `variant`
- Inline conditional class strings instead of a declarative variant config
- Piling props onto one component instead of composing named parts
- Duplicating a component per element type (Button/LinkButton/IconButton) instead of a polymorphic element
- Baking markup/styles into the stateful/behavior layer, blocking reuse across skins

## Clean-code invariants

- No hardcoded values
- One enumerated prop over many booleans
- Compose don't configure
- Encapsulate the design rule (accept tokens/variants, not raw values)
- Behavior separate from presentation
