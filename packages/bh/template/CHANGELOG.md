# Changelog

## 0.10.0 · 2026-10-18 19:33 +04:00

- fix(template,ui): keep a pill its own width in a grid cell or a stack (fccf29b)
  - draw the pill renderer's pills in a span of their own, so a grid or a stack stretches the span, not the pill
  - update the Renderers page's copy of the pill renderer
- feat(docs,template): name the kinds each entry is the default for in a registry's table (faeabd3)
  - add a `defaults` attribute to the entries block: a map of each kind's entry, `defaults: baseDefaultRenderers`
  - add a Default for column to the table it draws
  - name baseDefaultRenderers on the Renderers page
- feat(docs,template,ui)!: add define functions for entries, and list entries from their registries (4f92013)
  - add defineFormat, defineRenderer and defineTemplateLayout, which check an entry and type it by its options
  - define every format, renderer and template layout with them
  - stop exporting the empty registries; baseFormats, baseRenderers and baseTemplateLayouts build on them
  - add an entries block to the docs site: `- entries: baseFormats` reads a registry's entries from its code, as a table and each entry's whole file
  - list the Formats, Renderers and Layouts pages' entries with it
  - BREAKING CHANGE: an entry is defined with its define function: `noFormats.define(…)` → `defineFormat(…)`, `noRenderers.define(…)` → `defineRenderer(…)`, `noTemplateLayouts.define(…)` → `defineTemplateLayout(…)`. noFormats, noRenderers and noTemplateLayouts are no longer exported.

## 0.9.0 · 2026-10-18 13:35 +04:00

- feat(template,ui,view)!: each renderer and layout is one file in @bh/ui (968a12e)
  - BREAKING CHANGE: @bh/template no longer exports noRendererSpecs, noLayoutSpecs, baseRendererSpecs, baseLayoutSpecs, the per-entry renderer and layout specs, BaseRenderers, BaseLayouts, baseDefaultRenderers, Gap or the renderer and layout options types; import them from @bh/ui. The flex layout is gone: use row, or stack for a column. TemplateNode, Host and @bh/view's Column, View and the rest default to AnyLayouts, not bh's layouts.
- docs(template): each entry's whole file, spec and component both (d20c75e)
- feat(template,ui): each of bh's formats, renderer specs and layout specs is a file and an export of its own (7eb677f)
- docs(template): each registry's page in five parts, and shorter text (5b1afd2)
- feat(template,ui): the empty registries are exported, and each base format is its own constant (a297519)
