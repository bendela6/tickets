---
title: Layout
summary: The breakpoints a screen changes at, the widths a form rearranges at,
  and the widths of borders and focus.
order: 8
related: [Spacing, Elevation]
---

[//]: # 'written from layout.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Layout

A screen changes at the window's breakpoints, and a form at its own width.

**Breakpoints**

| Variant | From   |
| ------- | ------ |
| `sm:`   | 640px  |
| `md:`   | 768px  |
| `lg:`   | 1024px |
| `xl:`   | 1280px |
| `2xl:`  | 1536px |

**Containers**

| Variant          | From  | For                                                                 |
| ---------------- | ----- | ------------------------------------------------------------------- |
| `@form-labels:`  | 520px | a form's labels sit beside their fields from this width of the form |
| `@form-columns:` | 760px | a form's columns sit side by side from this width of the form       |

## Breakpoints

Tailwind's five, in pixels here; the stylesheet has them in rem. Two of
them change what the components do:

- **Below `md:`** the shell's sidebar becomes a drawer, opened from the top
  bar.
- **Below `md:` or `lg:`**, as its `overlayBelow` says, a side panel floats
  over the content instead of sitting beside it.

Code that needs the same answer, rather than a class, asks `useIsNarrow`,
which reads the same tokens:

```ts
useIsNarrow(breakpoint: PanelBreakpoint | undefined): boolean
```

| Parameter               | Type                           | Default | Description |
| ----------------------- | ------------------------------ | ------- | ----------- |
| `breakpoint` (required) | `PanelBreakpoint \| undefined` |         |             |

Returns `boolean`.

## Containers

A form measures its own width, not the window's, so a form in a narrow
drawer stacks its labels however wide the window is. From 520 pixels of the
form, labels sit beside their fields (`@form-labels:`); from 760, a form's
columns sit side by side (`@form-columns:`).

## Borders and focus

**Borders**

| Token      | Value | For                                                                           |
| ---------- | ----- | ----------------------------------------------------------------------------- |
| `border-1` | 1px   | dividers, table rules, inputs, cards                                          |
| `border-2` | 2px   | outline controls — edges you act on                                           |
| `ring-4`   | 4px   | the focus halo: step 9 at 22% (30% dark), around a step-11 rim (9 dark)       |
| `ring-2`   | 2px   | the focus rim alone, inset, where a halo has no room: a row, a joined control |

The number in `border-*` and `ring-*` is pixels, and any whole number
compiles. A control never draws its own focus: `focusRing` gives it the rim
and the halo, or the inset rim alone inside a row.

```ts
focusRing(hue: Hue, on?: FocusTrigger, placement?: FocusPlacement): string
```

Every control's focus treatment. Pass the ramp it paints from; pass a trigger
when the default is wrong.

Returns a plain string so it composes inside a `variants()` config, which is
what lets the safelist extractor see the interpolated classes.

| Parameter        | Type             | Default           | Description |
| ---------------- | ---------------- | ----------------- | ----------- |
| `hue` (required) | `Hue`            |                   |             |
| `on`             | `FocusTrigger`   | `'focus-visible'` |             |
| `placement`      | `FocusPlacement` | `'outward'`       |             |

Returns `string`.
