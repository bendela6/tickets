# Design-System Adapter Template

This file is the **only** place stack specifics live for the design→code skill
set. The four generic skills — `tokenizing-the-design`, `mapping-component-states`,
`implementing-a-component`, `verifying-a-component` — name no framework, file
path, or tool of their own; they read a filled copy of this adapter (e.g.
`design-system-adapter.md`) to learn how *this* project does each thing. To
onboard a new project, copy this file, fill in the six fields below, and
nothing in the generic skills needs to change.

## designSource

The token file(s) plus the design reference used for visual baselines (spec
doc, exported design file, baseline screenshots/images).

TODO: fill per project

## tokenPipeline

The token file path/format, the codegen command that turns tokens into
consumable code, and the lint commands that forbid hardcoded literals and
wrong-tier token usage.

TODO: fill per project

## workbench

How to render a single component state in isolation (a gallery route,
Storybook, a playground page, etc.) and the exact command to run it.

TODO: fill per project

## testCommands

The behavioral test runner, the accessibility scan, the visual-regression
run, and its baseline-update command.

TODO: fill per project

## componentConventions

Where components live in the repo, the headless-layer idiom (hook /
composable / builder) used to separate behavior from markup, and the tool
used to drive variant styling.

TODO: fill per project

## knownTraps

Project-specific styling gotchas that have bitten before — things a generic
skill would never guess (CSS layering quirks, preflight/reset state, utility
merge bugs, native control leakage, etc.).

TODO: fill per project
