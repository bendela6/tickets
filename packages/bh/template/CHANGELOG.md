# Changelog

## 0.9.0 · 2026-10-18 13:35 +04:00

- feat(template,ui,view)!: each renderer and layout is one file in @bh/ui (968a12e)
  - BREAKING CHANGE: @bh/template no longer exports noRendererSpecs, noLayoutSpecs, baseRendererSpecs, baseLayoutSpecs, the per-entry renderer and layout specs, BaseRenderers, BaseLayouts, baseDefaultRenderers, Gap or the renderer and layout options types; import them from @bh/ui. The flex layout is gone: use row, or stack for a column. TemplateNode, Host and @bh/view's Column, View and the rest default to AnyLayouts, not bh's layouts.
- docs(template): each entry's whole file, spec and component both (d20c75e)
- feat(template,ui): each of bh's formats, renderer specs and layout specs is a file and an export of its own (7eb677f)
- docs(template): each registry's page in five parts, and shorter text (5b1afd2)
- feat(template,ui): the empty registries are exported, and each base format is its own constant (a297519)
