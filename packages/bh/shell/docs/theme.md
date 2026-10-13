---
title: Theme
summary: Light, dark or the OS's, stamped on the page's root, remembered under
  the app's own key, and changed from the sidebar.
order: 4
related: [AppShell, Dark mode, Styles and fonts, The app names its own]
---

[//]: # 'written from theme.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Theme

Light, dark or the OS's, stamped on the page's root, remembered under the
app's own key, and changed from the sidebar.

The theme is two attributes on `<html>`. `data-theme` is the theme
painted, `light` or `dark`, which every `dark:` class follows
([Dark mode](../../ui/docs/foundations/dark-mode.md)). `data-theme-preference` is what the
reader picked: `light`, `dark`, or `system`, which follows the OS.

## Import

```tsx
import { applyTheme, readStoredTheme, ThemeChoice, ThemeFooter, useTheme } from '@bh/shell';
```

## Before the first render

The app stamps the theme before React renders, from what the reader
picked last, so the page never paints in the wrong one. The key is the
app's, named after it, and the same key goes to `useTheme` and
`ThemeFooter`; [The app names its own](../../../../apps/docs/content/getting-started/app-names-its-own.md)
keeps all of an app's keys in one module.

```ts
import { applyTheme, readStoredTheme } from '@bh/shell';

// The light/dark choice: applyTheme's, useTheme's and ThemeFooter's key.
const THEME_STORAGE_KEY = 'bookshop-theme';

applyTheme(readStoredTheme(THEME_STORAGE_KEY), THEME_STORAGE_KEY);
```

`readStoredTheme` returns the preference stored under the key, or
`system` when there is none or it is not one of the three. `applyTheme`
resolves it, asking the OS for `system`, stamps both attributes, and
stores the preference under the key. Where storage is unavailable, as in
some private windows, the theme still applies to the page.

## The control

`useTheme(key)` reads both attributes and keeps every component that uses
it in step: when one sets a theme, every other re-renders, with no store
between them. Its `setPreference` applies the pick and stores it under the
key.

`ThemeChoice` is the control: a strip of Light, Dark and System. It
applies nothing itself, so it takes the preference to show and a function
to call with the pick.

**Light, dark or system**

```tsx
import { ThemeChoice, useTheme } from '@bh/shell';
import { Card } from '@bh/ui';

// The app's own key: two apps on one origin must not share it.
const THEME_STORAGE_KEY = 'garden-theme';

export function LightDarkOrSystem() {
  const { preference, theme, setPreference } = useTheme(THEME_STORAGE_KEY);
  return (
    <div className="bg-gray-1 p-16">
      <Card padding={4} className="flex max-w-320 flex-col gap-12">
        <ThemeChoice preference={preference} onChange={setPreference} />
        <p className="text-13/19 text-gray-11">
          Picked: <span className="text-gray-12 font-mono">{preference}</span>. Painted:{' '}
          <span className="text-gray-12 font-mono">{theme}</span>.
        </p>
      </Card>
    </div>
  );
}
```

While the preference is `system`, a mounted `useTheme` follows the OS as
it changes. `offer` narrows the strip to some of the three, which are
drawn in the order light, dark, system.

## In the footer

`ThemeFooter` is a ready `footer` for `AppShell`, given the same key, as
the root route on [AppShell](app-shell.md#a-whole-app) passes it.
Expanded, it offers Light and Dark; at rail width it is one icon that
flips to the other theme.

It offers no System, since a reader who never picked one already follows
the OS. Picking the theme already painted changes nothing, so it does not
pin a theme that was following the OS.

**The footer at both widths**

```tsx
import { ThemeFooter } from '@bh/shell';

export function TheFooterAtBothWidths() {
  return (
    <div className="bg-gray-1 flex items-end gap-24 p-16">
      <div className="border-gray-6 w-240 border-1">
        <ThemeFooter collapsed={false} storageKey="garden-theme" />
      </div>
      <div className="border-gray-6 w-48 border-1">
        <ThemeFooter collapsed storageKey="garden-theme" />
      </div>
    </div>
  );
}
```

## Rules

- **Both halves on `<html>`.** `data-theme` is the theme painted,
  `data-theme-preference` the pick, and every `useTheme` reads them
  there rather than holding a copy.
- **The key is the app's.** The theme is stored under the key passed to
  `applyTheme`, `useTheme` or `ThemeFooter`, and nowhere else. Every app
  on `localhost` shares one origin in development, so the key carries the
  app's name.
- **`system` by default.** A missing or unknown stored value reads as
  `system`.
- **`system` follows the OS while a `useTheme` is mounted.** `applyTheme`
  alone resolves it once.
- **The control applies only what it offers.** A value that is not one
  of its options is ignored.
- **A `TooltipProvider` above `ThemeFooter`.** At rail width its icon is
  named in a tooltip.

## Reference

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
readStoredTheme(storageKey: string): ThemePreference
```

The preference stored under the app's key, or `system` when there is none.

An unset preference resolves to the OS theme anyway, so the painted result is
the same as reading `prefers-color-scheme` here — but returning `system`
keeps "never chose" distinguishable from "chose the theme the OS happens to
be on", which is the distinction a three-way control shows.

| Parameter               | Type     | Default | Description                                          |
| ----------------------- | -------- | ------- | ---------------------------------------------------- |
| `storageKey` (required) | `string` |         | The key `applyTheme` stored it under, the app's own. |

Returns `ThemePreference`: The stored preference, or `system` for none, an unknown value, or no storage.

```ts
resolveTheme(preference: ThemePreference): Theme
```

The theme a preference resolves to right now.

| Parameter               | Type              | Default | Description                                                          |
| ----------------------- | ----------------- | ------- | -------------------------------------------------------------------- |
| `preference` (required) | `ThemePreference` |         | `light` and `dark` are themselves; `system` asks `DARK_MEDIA_QUERY`. |

Returns `Theme`.

```ts
const DARK_MEDIA_QUERY: '(prefers-color-scheme: dark)';
```

The media query `system` defers to. Exported so watchers subscribe to the same one.

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

```ts
interface ThemeState
```

What a theme control needs: the raw choice, the painted result, a setter.

| Member                     | Type                                               | Default | Description                                                                      |
| -------------------------- | -------------------------------------------------- | ------- | -------------------------------------------------------------------------------- |
| `preference` (required)    | `ThemePreference`: `'light'`, `'dark'`, `'system'` |         | What the reader picked, from `data-theme-preference`; `system` when nothing was. |
| `theme` (required)         | `Theme`: `'light'`, `'dark'`                       |         | The theme painted, from `data-theme`: what `system` resolved to, or the pick.    |
| `setPreference` (required) | `(next: ThemePreference) => void`                  |         | Applies a preference and remembers it under the hook's key (`applyTheme`).       |

```ts
type ThemePreference = Theme | 'system';
```

What the user picked. `system` defers to the OS and re-resolves as the OS changes.

One of `'light'`, `'dark'`, `'system'`.

### ThemeChoice

| Prop                    | Type                                               | Default                       | Description                                                                                                                  |
| ----------------------- | -------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `preference` (required) | `ThemePreference`: `'light'`, `'dark'`, `'system'` |                               | The option shown as picked: `useTheme`'s `preference`, or its `theme` to offer two.                                          |
| `onChange` (required)   | `(next: ThemePreference) => void`                  |                               | Called with the option picked; the control applies nothing itself.                                                           |
| `offer`                 | `readonly ThemePreference[]`                       | `['light', 'dark', 'system']` | Which preferences to offer. Defaults to all three. They are drawn in the order light, dark, system, whatever the order here. |

### ThemeFooter

| Prop                    | Type      | Default | Description                                                              |
| ----------------------- | --------- | ------- | ------------------------------------------------------------------------ |
| `collapsed` (required)  | `boolean` |         | Whether the sidebar is at rail width — what AppShell's `footer` is told. |
| `storageKey` (required) | `string`  |         | Where the choice is remembered: the app's own key, e.g. `myapp-theme`.   |
