---
title: Elevation
summary: A shadow says how far above the page a thing sits; a layer, what it sits over.
order: 6
related: [Radius, Dark mode]
---

[//]: # 'written from elevation.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Elevation

A shadow says how far above the page a thing sits, and its layer what it sits over.

## Shadows

Everything that floats over the page takes `shadow-lg`: dialogs, drawers,
menus, popovers and toasts. `shadow-xs` is a card resting on a canvas, and
`shadow-md` the same card lifted while it is dragged.

**Shadow**

| Token             | Value, light                                                          | Dark                                                           | For                                                                      |
| ----------------- | --------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `shadow-xs`       | 0 1px 2px rgba(28, 26, 20, 0.06)                                      | 0 1px 2px rgba(0, 0, 0, 0.4)                                   | a card resting on a canvas: a diagram node                               |
| `shadow-md`       | 0 6px 16px rgba(28, 26, 20, 0.10), 0 2px 4px rgba(28, 26, 20, 0.06)   | 0 6px 16px rgba(0, 0, 0, 0.45), 0 2px 4px rgba(0, 0, 0, 0.3)   | a card lifted while it is dragged                                        |
| `shadow-lg`       | 0 16px 40px rgba(28, 26, 20, 0.16), 0 4px 10px rgba(28, 26, 20, 0.08) | 0 16px 40px rgba(0, 0, 0, 0.55), 0 4px 10px rgba(0, 0, 0, 0.4) | all that floats over the page: dialogs, drawers, menus, popovers, toasts |
| `shadow-artboard` | 0 1px 2px rgba(28, 26, 20, 0.07), 0 10px 28px rgba(28, 26, 20, 0.09)  | 0 0 0 1px rgba(0, 0, 0, 0.5), 0 12px 34px rgba(0, 0, 0, 0.55)  | a sheet framed on a canvas; in dark, an edge as well                     |

Shadows are the one family whose two themes differ in kind. The light theme
tints with the page's warm gray; the dark theme occludes with black, since a
tint doesn't show on a dark ground.

## Layers

Three numbers stack the page. The number in the class is the z-index, so
any whole number compiles; these three are the ones overlays use.

**Layers**

| Token  | Value | For                      |
| ------ | ----- | ------------------------ |
| `z-10` | 10    | pinned headers, toolbars |
| `z-40` | 40    | the dim behind a dialog  |
| `z-50` | 50    | dialogs, menus, toasts   |

A dialog's dim sits over pinned headers and toolbars, and the dialog over
its dim. Menus, popovers, toasts and tooltips take the dialog's `z-50`.
