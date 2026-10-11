---
title: Radius
summary: Six radii named by their pixels, each with its jobs; a component's
  radius moves with its size.
order: 5
related: [Spacing, Elevation]
---

[//]: # 'written from radius.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Radius

Six radii, named by their pixels: `rounded-6` is six.

`rounded-*` takes any whole number, so the six are an agreement rather than
a limit, and Tailwind's named radii (`rounded-md`) aren't there.

**Radius**

| Token        | Value | For                                                |
| ------------ | ----- | -------------------------------------------------- |
| `rounded-3`  | 3px   | xs form controls — 30px fields                     |
| `rounded-4`  | 4px   | chips, tags, inline marks · md fields              |
| `rounded-5`  | 5px   | lg form controls — 46px fields                     |
| `rounded-6`  | 6px   | sm buttons and md cards, tabs, menu rows, tooltips |
| `rounded-8`  | 8px   | md buttons and lg cards, popovers, menus, toasts   |
| `rounded-12` | 12px  | lg buttons and xl cards, dialogs                   |

## Radius moves with size

A component's radius changes with its height:

| Component                  | Small | Medium | Large |
| -------------------------- | ----- | ------ | ----- |
| Fields (`xs`, `md`, `lg`)  | 3     | 4      | 5     |
| Buttons (`sm`, `md`, `lg`) | 6     | 8      | 12    |
| Cards (`md`, `lg`, `xl`)   | 6     | 8      | 12    |

3, 4 and 5 belong to the three field heights alone. A 4 beside a 5 is too
close to read as a choice, so on anything but a field it reads as a
mistake.

## Borders

Border widths are numbers too, `border-1` and `border-2`, with their jobs
on [Layout](layout.md#borders-and-focus).
