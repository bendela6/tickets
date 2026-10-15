---
title: Overview
summary: React hooks that hold state and behaviour and draw nothing, shared by
  bh's packages and the apps.
order: 1
related: [Writing a hook, Adding bh to an app, The app names its own]
---

[//]: # 'written from overview.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Overview

React hooks that hold state and behaviour and draw nothing, shared by
bh's packages and the apps.

These are the hooks each package, and app after app, wrote again for
itself. A hook here returns state and the functions that change it; the
component that calls it draws, with whatever markup and styles are its
own. `@bh/ui`, `@bh/table`, `@bh/code`, `@bh/shell` and `@bh/markdown`
take theirs from here, so an app that uses one gets the same behaviour bh's
components have.

The package is new: its hooks move in one at a time from the packages
that wrote them, each with a page here, and each in the one shape
[Writing a hook](writing-a-hook.md) lays out.

## The hooks

- [useAction](use-action.md): an async action run from the page,
  with whether it is going, what went wrong and what it gave back.
- [useDebouncedCallback](use-debounced-callback.md): a callback
  made once its calls stop for a delay, which can be made now or
  dropped.
- [useDebouncedValue](use-debounced-value.md): a value that
  follows another once it stops changing for a delay.
- [useDisclosure](use-disclosure.md): open and fold a region from
  a button, with the props for both.
- [useDrag](use-drag.md): a handle dragged by the pointer, from
  where it went down, for a resize handle, a divider or a card.
- [useElementSize](use-element-size.md): an element's width and
  height, before it paints and as it changes.
- [useHotkeys](use-hotkeys.md): keys that work anywhere on the
  page, leaving alone what the reader is typing.
- [useIsClipped](use-is-clipped.md): whether a text runs past its
  box, for a hint that shows only when there is more to read.
- [useMediaQuery](use-media-query.md): whether a CSS media query
  matches, now and as it changes.
- [useNow](use-now.md): the time now, ticking every second or
  every interval it is given.
- [usePersistedState](use-persisted-state.md): `useState` that
  remembers, under the app's key, in step across the page and the
  app's tabs; with `readStored` and `writeStored`.
- [useResizeHandle](use-resize-handle.md): a separator dragged,
  or moved with the arrow keys, to resize what it sits beside.
- [useScrollSpy](use-scroll-spy.md): which of a page's sections
  is in view, for an "On this page" list that lights it.

## Taking it

`@bh/ui`, `@bh/table`, `@bh/code`, `@bh/shell` and `@bh/markdown` need
it, so an app that takes any of them takes `hooks` too, on the gateway's bh page
([Adding bh to an app](../../../../apps/docs/content/getting-started/adding-bh.md)). The project that
calls a hook itself depends on the copy:

```json
"dependencies": {
  "@bh/hooks": "workspace:*"
}
```

Its one peer is `react`. It has no stylesheet to import.

## Rules

- A hook draws nothing: no component, no markup and no stylesheet. A
  test reads the package's files to keep it so.
- It imports React alone: no other package, bh's included, since every
  package that draws sits above it.
- What it keeps, it keeps under a name the app hands in, as the rest of
  bh does ([The app names its own](../../../../apps/docs/content/getting-started/app-names-its-own.md)).
