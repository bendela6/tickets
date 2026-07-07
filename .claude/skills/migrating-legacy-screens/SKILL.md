---
name: migrating-legacy-screens
description: Use when porting a legacy screen or component from styles/globals.css to the instrument design system, when deleting legacy CSS, or when a new primitive misbehaves on some screens only — legacy and redesigned code coexist during the phase-by-phase replacement.
---

# Migrating Legacy Screens

## Overview

Legacy `globals.css` is unlayered; Tailwind utilities live in `@layer`. Any legacy **element selector** (`button {…}`, `input {…}`, `a {…}`) therefore beats every utility on every screen — including fully redesigned ones. Migration is as much about *removing reach* as porting pixels. Real case: `button { font: inherit }` in globals.css silently overrode the new Button's `text-[13px] font-medium` everywhere.

## The recipe — porting one screen

1. **Inventory the reach first.** Before touching the screen, list the globals.css selectors that can hit it: the class selectors the screen uses, and every element selector in the file. Element selectors go on a tracked retirement list — they leak into redesigned screens, so they are the highest-value deletions in the whole migration.
2. **Port with primitives.** Rebuild the screen from `apps/web/src/ui` per the `implementing-from-design` skill. New CSS never goes into globals.css.
3. **Delete, don't strand.** Remove the screen's now-dead globals.css rules in the same task. Before deleting any rule, grep its class name repo-wide — a rule shared with a not-yet-ported screen stays, recorded in the retirement list with its remaining users.
4. **Retire element selectors the moment their last dependent screen is ported.** Check the retirement list every migration; an element selector with zero legacy users left is deleted immediately.
5. **Regression pass, both sides.** The ported screen goes through `verifying-against-design`. Every remaining legacy screen that shared a deleted rule gets a load-and-click-through smoke check — legacy screens have no spec to measure against, so smoke is the bar.
6. **Commit per screen:** `feat(web): port <screen> to instrument`, listing deleted rules and retirement-list changes in the body.

## Quick diagnosis

A utility class "not applying" on a redesigned component → grep `styles/globals.css` for an element selector touching that property **before** suspecting Tailwind, twMerge, or the component.

## Red flags

- "I'll leave the old CSS, it's harmless" — unlayered element selectors are never harmless.
- "This rule looks unused" — grep before delete; visual inspection lies about reach.
- "I'll clean globals.css up at the end" — stranded rules bite every screen ported between now and "the end".
