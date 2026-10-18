# Changelog

## 0.1.3 · 2026-10-19 00:15 +04:00

- feat(web): show the version line under the app's name (678e4b7)
  - Move the version line from the sidebar's footer into the brand's caption
- chore(deps): bring in bh's changes to richtext and shell (84c29b8)
  - Move the version line under the app's name
  - An app moves the version line from AppShell's footer into its brand, `<BuildFooter info={BUILD} collapsed={collapsed} />` in `footer` → `caption: <BuildLine info={BUILD} />` in `brand`.
  - Require Tiptap 3.31.4, so the editor stays a textbox
- chore(deps): bring in bh's changes to shell, template and ui (b112de8)
  - Pass storageKey in the Version page's footer example
  - Keep a pill its own width in a grid cell or a stack
  - Name the kinds each entry is the default for in a registry's table
  - Add define functions for entries, and list entries from their registries
  - An entry is defined with its define function: `noFormats.define(…)` → `defineFormat(…)`, `noRenderers.define(…)` → `defineRenderer(…)`, `noTemplateLayouts.define(…)` → `defineTemplateLayout(…)`. noFormats, noRenderers and noTemplateLayouts are no longer exported.

## 0.1.2 · 2026-10-18 15:39 +04:00

- feat(web): put the version line last in the sidebar (3957a6d)
  - Move the version line below the theme switch
- chore(deps): bring in bh's changes to shell (6e99f96)
  - Show how long ago the version line's release was

## 0.1.1 · 2026-10-18 15:09 +04:00

- chore(deps): bring in bh's changes to config and shell (2ef5f23)
  - Write "1 commit" on the Version page's overview
  - Let bh-release run in a linked worktree
  - Read the router's Link only when the Version page draws a link
  - Leave services out of the Version page of a repo with none
  - Move the stack on commits outside every package
  - Give tests no build info, even when they share the app's Vite config
  - Let the Version page compile in an app whose router types its routes

## 0.1.0 · 2026-10-18 14:03 +04:00

- Start keeping versions and this changelog
