---
title: ScreenState
summary: 'What a screen shows in place of its content: loading, empty, not
  found, or an error.'
related: [Spinner, CardState, Card, Toast]
---

[//]: # 'written from screen-state.doc.yaml by pnpm docs:sync; edit that file, not this one'

# ScreenState

What a screen shows in place of its content: loading, empty, not found,
or an error.

One component draws them all, and `tone` and `icon` tell them apart: the
icon sits in a disc of the tone, above a title, a line of body and an
action, each optional but the title. `state="loading"` puts a spinner in
the disc while the content is on its way.

## Import

```tsx
import { ScreenState } from '@bh/ui';
```

## Examples

An error takes the `danger` tone, and an action to try again.

**An error**

```tsx
import { Button, ScreenState } from '@bh/ui';

export function AnError() {
  return (
    <ScreenState
      tone="danger"
      icon="triangle-alert"
      title="Couldn't load the files"
      body="The server isn't responding. Check your connection, then try again."
      action={<Button variant="outline">Retry</Button>}
    />
  );
}
```

An empty state takes the `neutral` tone, the default, or `success` when
empty is the good outcome.

**Empty**

```tsx
import { ScreenState } from '@bh/ui';

export function Empty() {
  return (
    <div className="flex flex-col gap-16">
      <ScreenState icon="search" title="No files yet" body="Files you upload show up here." />
      <ScreenState
        tone="success"
        icon="circle-check"
        title="Everything is synced"
        body="Changes made in the last 14 days are all saved."
      />
    </div>
  );
}
```

Without `icon`, there is no disc.

**Not found**

```tsx
import { ScreenState } from '@bh/ui';

export function NotFound() {
  return (
    <ScreenState
      title="Page not found"
      action={
        <a href="#" className="text-12/17 text-indigo-11 hover:underline">
          Back to files
        </a>
      }
    />
  );
}
```

`state="loading"` stands in while the content is on its way: a spinner
in the disc, and a title, `Loading…` unless you say what is loading.
`body`, `action` and `tone` work as they do in the other states; `icon`
doesn't, since the spinner takes its place.

**Loading**

```tsx
import { ScreenState } from '@bh/ui';

export function Loading() {
  return (
    <div className="flex flex-col gap-16">
      <ScreenState state="loading" />
      <ScreenState
        state="loading"
        title="Loading the files…"
        body="A folder this size takes a few seconds."
      />
    </div>
  );
}
```

It waits 400 milliseconds before it shows, so a load that answers sooner
flashes nothing; `delay` sets the wait, and `0` shows it at once. Until
then it is drawn but invisible, at the height it shows at. The spinner
sits in the disc an icon would, so going from loading to a state with an
icon and the same lines keeps the height too.

Below, a load of 0.2 seconds goes straight to the empty state, and one of
2 seconds shows the spinner first. The card keeps its height either way.

**A fast load**

```tsx
import { useEffect, useState } from 'react';
import { Button, Card, ScreenState } from '@bh/ui';

export function AFastLoad() {
  // How long the load being shown takes, in milliseconds; null once it has answered.
  const [loading, setLoading] = useState<number | null>(null);
  useEffect(() => {
    if (loading === null) {
      return undefined;
    }
    // Stands in for the request.
    const timer = setTimeout(() => setLoading(null), loading);
    return () => clearTimeout(timer);
  }, [loading]);
  return (
    <div className="flex w-320 flex-col gap-12">
      <div className="flex gap-8">
        <Button size="sm" onClick={() => setLoading(200)}>
          Load in 0.2 s
        </Button>
        <Button size="sm" onClick={() => setLoading(2000)}>
          Load in 2 s
        </Button>
      </div>
      <Card>
        {loading === null ? (
          <ScreenState icon="search" title="No files yet" />
        ) : (
          <ScreenState state="loading" title="Loading the files…" />
        )}
      </Card>
    </div>
  );
}
```

## Keyboard and accessibility

The title is a plain `div`, not a heading, and the block is not a live
region: a screen reader reads it in place but doesn't announce it when it
appears.

While loading, the block is `aria-busy`, and its title and body sit in a
`status` region, which a screen reader announces politely when the delay
is up; until then, nothing in it can be reached. The spinner is unnamed,
since the title says what is loading. For a reader who asked for less
motion, it fades in place instead of turning.

## When not to use it

- For a card that loads, use [CardState](../card-state/card-state.md):
  it waits, fails and comes up empty in one place.
- For something loading inside a line or a control, use a
  [Spinner](../spinner/spinner.md), or a
  [Button](../../../primitives/components/button/button.md)'s `loading`.

## Props

| Prop        | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Default     | Description                                                                                                        |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------ |
| `state`     | `'loading'`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |             | `loading` while the content is on its way. Unset, the block says what happened in its place.                       |
| `title`     | `ReactNode`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |             | One line saying what happened, required; while loading, what is on its way, `Loading…` unless set.                 |
| `icon`      | `IconName`: `'columns'`, `'filter'`, `'search'`, `'link'`, `'circle'`, `'circle-half'`, `'circle-dot'`, `'circle-dashed'`, `'circle-check'`, `'circle-x'`, `'circle-info'`, `'diamond'`, `'square'`, `'dot'`, `'arc'`, `'triangle-alert'`, `'chevron-up'`, `'chevron-down'`, `'chevron-left'`, `'chevron-right'`, `'arrow-up'`, `'arrow-down'`, `'arrow-up-right'`, `'arrow-up-down'`, `'plus'`, `'x'`, `'check'`, `'minus'`, `'maximize'`, `'minimize'`, `'copy'`, `'pencil'`, `'trash'`, `'refresh'`, `'grip'`, `'ellipsis'`, `'undo'`, `'redo'`, `'eye'`, `'rows'`, `'rows-compact'`, `'columns-2'`, `'rows-2'`, `'folder'`, `'file'`, `'terminal'`, `'sliders'`, `'calendar'`, `'clock'`, `'tag'`, `'user'`, `'lock'`, `'text-cursor'`, `'sun'`, `'moon'`, `'monitor'`, `'list'`, `'quote'` |             | A mark above the title, in a disc of the tone. No disc without it; while loading, the spinner takes its place.     |
| `delay`     | `number`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `400`       | While loading, how long it waits before it shows, in milliseconds, so a load that answers sooner never flashes it. |
| `tone`      | `Tone`: `'primary'`, `'secondary'`, `'success'`, `'warning'`, `'danger'`, `'neutral'`, `'red'`, `'orange'`, `'yellow'`, `'green'`, `'teal'`, `'cyan'`, `'blue'`, `'indigo'`, `'purple'`, `'pink'`, `'gray'`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `'neutral'` | Which ramp the disc paints from: a role, or a hue by name.                                                         |
| `body`      | `ReactNode`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |             | A line or two under the title.                                                                                     |
| `action`    | `ReactNode`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |             | Something to do about it, under the body: a button or a link.                                                      |
| `className` | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |             | Added to the outer block's classes.                                                                                |
