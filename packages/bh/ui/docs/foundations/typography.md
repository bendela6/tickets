---
title: Typography
summary: Twelve sizes named by their pixels, leading set where the text is,
  three weights and two families.
order: 3
related: [Spacing]
---

[//]: # 'written from typography.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Typography

A size is named by its pixels, `text-13`, and its leading is set beside it: `text-13/19`.

Twelve sizes, from 9 to 24 pixels, and no others: Tailwind's named sizes
(`text-sm`) aren't there. A size sets no leading of its own, so text takes
its parent's until the class gives one.

**Sizes**

| Token     | Value |
| --------- | ----- |
| `text-9`  | 9px   |
| `text-10` | 10px  |
| `text-11` | 11px  |
| `text-12` | 12px  |
| `text-13` | 13px  |
| `text-14` | 14px  |
| `text-15` | 15px  |
| `text-16` | 16px  |
| `text-18` | 18px  |
| `text-20` | 20px  |
| `text-22` | 22px  |
| `text-24` | 24px  |

**Weights**

| Token      | Value |
| ---------- | ----- |
| `font-400` | 400   |
| `font-500` | 500   |
| `font-600` | 600   |

**Families**

| Token       | Value                                    |
| ----------- | ---------------------------------------- |
| `font-sans` | 'IBM Plex Sans', system-ui, sans-serif   |
| `font-mono` | 'IBM Plex Mono', ui-monospace, monospace |

## Leading

The number after the slash is the line height in pixels, any whole number,
set where the text is. The pairs `@bh/ui` uses most:

| Class        | Where                                                   |
| ------------ | ------------------------------------------------------- |
| `text-13/19` | the default: menus, table cells, controls               |
| `text-12/17` | the line below it: a field's help and error, a shortcut |
| `text-11/16` | kickers, table heads, the JSON viewer                   |
| `text-11/13` | labels in capitals: a field's label, a section header   |

## Weights

`font-400`, `font-500` and `font-600`: the weights the app's fonts load.
Any other is drawn by the browser, thickening or thinning the nearest,
which reads as a different face.

## Families

`font-sans`, IBM Plex Sans unless the app names another, for reading and
for controls. `font-mono`, IBM Plex Mono unless it names another, for
code, keys, times and figures that line up. The app loads both from
Google Fonts, or picks its own:
[Styles and fonts](../../../../../apps/docs/content/getting-started/styles-and-fonts.md#the-fonts).

## Tracking

Tailwind's own scale, for runs of capitals: a label in capitals takes
`tracking-wider`. It is never part of a size.

## Merging classes

`cn` merges class lists with tailwind-merge, which on its own takes
`text-13` for a colour and drops the real colour beside it. `@bh/ui`'s
`cn` knows the twelve sizes and three weights:

```ts
import { cn } from '@bh/ui';

// Both survive: text-13 is a size, text-indigo-11 a colour.
export const label = cn('text-13/19 text-gray-12', 'text-indigo-11');
```
