---
title: Dark mode
summary: Dark is data-theme="dark" on <html>; every colour and shadow has both
  values, and dark classes follow the attribute.
order: 9
related: [Colours, Elevation, Styles and fonts]
---

[//]: # 'written from dark-mode.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Dark mode

Dark is an attribute on `<html>`, `data-theme="dark"`, and every token follows it.

The stylesheet states each colour and shadow once per theme. A class names a
step, `bg-gray-2`, and the step's value follows the theme, so most code has
no dark half to write.

## What changes

- **The scales turn over.** In dark, step 1 is the darkest background and
  step 12 the lightest text; each step keeps its job.
- **Surfaces are stated per theme**: `surface-raised` is white in light and
  a lifted dark gray in dark.
- **Shadows change in kind**: the light theme tints, the dark one occludes
  with black ([Elevation](elevation.md#shadows)).
- **The focus rim moves a step**: step 11 in light, step 9 in dark, the
  readable step on each ground.

## The dark variant

`dark:` follows the attribute, not the operating system:

```css
@custom-variant dark (&:where([data-theme='dark'], [data-theme='dark'] *));
```

Reach for it only where a step's job differs between the themes, as the
focus rim's does: `border-indigo-11 dark:border-indigo-9`. Nothing in
`@bh/ui` reads `prefers-color-scheme`.

## Setting it

`@bh/ui` only reads the attribute; setting it is the app's job. With
`@bh/shell`, `applyTheme` stamps it before the first render
([Styles and fonts](../../../../../apps/docs/content/getting-started/styles-and-fonts.md#the-theme)) and the
theme control changes it. `system` follows the operating system while
something using `useTheme` is on screen, as `ThemeFooter` does.

```ts
applyTheme(preference: ThemePreference, storageKey: string): void
```

Applies a preference to the document root and stores it under the app's key.

Both halves are stamped: `data-theme` is the resolved theme the stylesheet
reads, `data-theme-preference` is the raw choice. The preference is on the
root too because it is what the theme control renders as selected, and
keeping it there means every consumer of `useTheme` observes the same source
rather than holding a private copy a sibling's change would leave stale.

| Parameter               | Type              | Default | Description                                                       |
| ----------------------- | ----------------- | ------- | ----------------------------------------------------------------- |
| `preference` (required) | `ThemePreference` |         | What the reader picked; `system` is resolved from the OS.         |
| `storageKey` (required) | `string`          |         | The app's own key, e.g. `myapp-theme`. A failed write is ignored. |

Returns `void`.

```ts
useTheme(storageKey: string): ThemeState
```

The theme, kept in sync with `<html>` through a `MutationObserver`, so every
component using this hook re-renders when the theme changes anywhere —
including from another component's setter call. `storageKey` is where the
setter remembers the choice; it is the app's own key.

| Parameter               | Type     | Default | Description                                                 |
| ----------------------- | -------- | ------- | ----------------------------------------------------------- |
| `storageKey` (required) | `string` |         | The app's own key, the one `applyTheme` was given at start. |

Returns `ThemeState`.

## Checking both

Every contrast pairing is measured in both themes
([Colours](colours.md#contrast)). On this site the theme control
at the foot of the nav switches every page and example.
