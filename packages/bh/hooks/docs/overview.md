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
own. `@bh/ui`, `@bh/table` and `@bh/shell` take theirs from here, so an
app that uses one gets the same behaviour bh's components have.

The package is new: its hooks move in one at a time from the packages
that wrote them, each with a page here, and each in the one shape
[Writing a hook](writing-a-hook.md) lays out.

## Taking it

`@bh/ui`, `@bh/table` and `@bh/shell` need it, so an app that takes any
of them takes `hooks` too, on the gateway's bh page
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
