---
title: useMediaQuery
summary: Whether a CSS media query matches, now and as it changes, for a layout
  that follows the window or the system's settings.
order: 3
related: [Writing a hook, Drawer, Theme]
---

[//]: # 'written from use-media-query.doc.yaml by pnpm docs:sync; edit that file, not this one'

# useMediaQuery

Whether a CSS media query matches, now and as it changes: a narrow
window, a dark system theme, a pointer that hovers. What changes with
it is the caller's.

## Import

```tsx
import { useMediaQuery } from '@bh/hooks';
```

## Examples

**What the browser says**

```tsx
import { useMediaQuery } from '@bh/hooks';

// Four media queries, each answered as the window and the system change: a
// plain list, no component of bh's.

const QUERIES = [
  { label: 'A window under 768 pixels', query: '(max-width: 767px)' },
  { label: 'A dark system theme', query: '(prefers-color-scheme: dark)' },
  { label: 'Less motion, asked for', query: '(prefers-reduced-motion: reduce)' },
  { label: 'A pointer that hovers', query: '(hover: hover)' },
];

function Answer({ label, query }: { label: string; query: string }) {
  const matches = useMediaQuery(query);
  return (
    <li className="flex items-baseline justify-between gap-16">
      <span>
        {label} <code className="text-11 text-gray-10">{query}</code>
      </span>
      <strong className={matches ? 'text-green-11' : 'text-gray-10'}>
        {matches ? 'Yes' : 'No'}
      </strong>
    </li>
  );
}

export function WhatTheBrowserSays() {
  return (
    <ul className="text-13/19 text-gray-12 flex w-480 flex-col gap-6">
      {QUERIES.map((item) => {
        return <Answer key={item.query} {...item} />;
      })}
    </ul>
  );
}
```

Make the window narrower than 768 pixels, or turn your system's dark
mode on: the answers change as you do. The query goes first, as a hook
about one value takes it: `useMediaQuery('(max-width: 767px)')`.

Prefer CSS where CSS can do it: a `md:` class or a `@media` rule needs
no render. This is for what a stylesheet can't change, as a panel that
docks beside the content or lays over it, or a list that draws fewer
rows.

## Rules

- **Its server value is `false`**, or `serverValue`: a server has no
  window. An app that renders only in the browser has the real answer
  on its first render, a hydrated page right after it; pass the
  `serverValue` a static page is most likely to need.
- **`undefined` is a query that matches nothing**, since a hook can't
  be called on a condition: `useMediaQuery(docked ? QUERY : undefined)`.
- **A browser with no `matchMedia`** gives the server value.
- **Cleaning up**: its `change` listener goes with the component, or
  with the query when a new one is passed.

@bh/ui's `useIsNarrow`, which docks a [Drawer](../../ui/src/library/overlays/components/drawer/drawer.md)
or lays it over the content, and @bh/shell's `useTheme`, which follows
the system's theme while the reader's choice is `system`, are built on
it.

## Reference

```ts
useMediaQuery(query: string | undefined, options?: UseMediaQueryOptions): boolean
```

Whether a CSS media query matches now, and again whenever that changes: a
narrow viewport, a dark system theme, a pointer that can hover. A hook
can't be called on a condition, so `undefined` is a query that matches
nothing.

Its server value is `serverValue`, `false` unless given: an app that
renders only in the browser has the real answer on its first render, a
hydrated page right after it.

| Parameter             | Type                   | Default | Description                                                                          |
| --------------------- | ---------------------- | ------- | ------------------------------------------------------------------------------------ |
| `query` (required)    | `string \| undefined`  |         | A media query, as `(max-width: 767px)`, or `undefined`.                              |
| `options`             | `UseMediaQueryOptions` | `{}`    |                                                                                      |
| `options.serverValue` | `boolean`              | `false` | What it is on a server, and in a browser with no `matchMedia`: `false` unless given. |

Returns `boolean`: Whether it matches.

```ts
interface UseMediaQueryOptions
```

What `useMediaQuery` takes after the query.

| Member        | Type      | Default | Description                                                                          |
| ------------- | --------- | ------- | ------------------------------------------------------------------------------------ |
| `serverValue` | `boolean` |         | What it is on a server, and in a browser with no `matchMedia`: `false` unless given. |
