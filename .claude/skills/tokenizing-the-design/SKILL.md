---
name: tokenizing-the-design
description: Use when turning a design's values into a token source of truth, adding or changing design tokens, or when a value would otherwise be hardcoded in a component.
---

## Overview

A design system is only trustworthy if it cannot silently drift from the design. Tokenizing turns the design into an executable artifact: every visual value gets a semantic name, and code is GENERATED from the token source rather than transcribed by hand. Under this model "code matches design" is true by construction, not by eye — there is nothing to eyeball because there was never a second, independent copy of the value.

## The recipe

1. Extract every distinct value from the design (color, space, size, radius, type, shadow, duration) and deduplicate — one canonical entry per visually-distinct value.
2. Structure into three tiers: primitive (raw value) → semantic (intent, via alias) → component (specific usage). Use aliases/references, never repeated values.
3. Author as ONE machine-readable token file. Themes (light/dark/high-contrast) are the SAME semantic names re-pointed to different primitives — a data change, never a code change.
4. Generate the code artifacts from the token file with a build step (per the project adapter). Never hand-copy a value into code.
5. Turn on two lint gates (per the adapter): (a) forbid any literal in themeable properties; (b) forbid primitive tokens inside components (semantic-only).

Consult the project adapter for the concrete file locations, generator command, and lint rule setup — this skill only defines the shape of the recipe.

## Programmatic gate (definition of done)

Token file schema-validates; all references resolve; lint is red on any literal or wrong-tier token. Extend, don't duplicate: a new value is a new semantic token or alias, never a repeated literal.

## Red flags (self-check — each means STOP)

- Hardcoding a hex/px/number in a component instead of referencing a token
- Using a primitive token (color.blue.600) in a component instead of a semantic one (color.action)
- Duplicating a value across tokens instead of aliasing
- Branching component code per theme instead of re-pointing semantic tokens
- Hand-copying a value from the design into code instead of generating it
