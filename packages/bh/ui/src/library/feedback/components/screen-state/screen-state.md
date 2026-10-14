---
title: ScreenState
summary: 'What a screen shows in place of its content: empty, not found, or an error.'
related: [Spinner, Card, Toast]
---

[//]: # 'written from screen-state.doc.yaml by pnpm docs:sync; edit that file, not this one'

# ScreenState

What a screen shows in place of its content: empty, not found, or an
error.

One component draws them all, and `tone` and `icon` tell them apart: the
icon sits in a disc of the tone, above a title, a line of body and an
action, each optional but the title.

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

## Keyboard and accessibility

The title is a plain `div`, not a heading, and the block is not a live
region: a screen reader reads it in place but doesn't announce it when it
appears.

## Props

| Prop               | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Default     | Description                                                        |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------ |
| `title` (required) | `ReactNode`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |             | One line saying what happened.                                     |
| `icon`             | `IconName`: `'columns'`, `'filter'`, `'search'`, `'link'`, `'circle'`, `'circle-half'`, `'circle-dot'`, `'circle-dashed'`, `'circle-check'`, `'circle-x'`, `'circle-info'`, `'diamond'`, `'square'`, `'dot'`, `'arc'`, `'triangle-alert'`, `'chevron-up'`, `'chevron-down'`, `'chevron-left'`, `'chevron-right'`, `'arrow-up'`, `'arrow-down'`, `'arrow-up-right'`, `'arrow-up-down'`, `'plus'`, `'x'`, `'check'`, `'minus'`, `'maximize'`, `'minimize'`, `'copy'`, `'pencil'`, `'trash'`, `'refresh'`, `'grip'`, `'ellipsis'`, `'undo'`, `'redo'`, `'eye'`, `'rows'`, `'rows-compact'`, `'folder'`, `'file'`, `'terminal'`, `'sliders'`, `'calendar'`, `'clock'`, `'tag'`, `'user'`, `'sun'`, `'moon'`, `'monitor'`, `'list'`, `'quote'` |             | A mark above the title, in a disc of the tone. No disc without it. |
| `tone`             | `Tone`: `'primary'`, `'secondary'`, `'success'`, `'warning'`, `'danger'`, `'neutral'`, `'red'`, `'orange'`, `'yellow'`, `'green'`, `'teal'`, `'cyan'`, `'blue'`, `'indigo'`, `'purple'`, `'pink'`, `'gray'`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `'neutral'` | Which ramp the icon's disc paints from: a role, or a hue by name.  |
| `body`             | `ReactNode`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |             | A line or two under the title.                                     |
| `action`           | `ReactNode`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |             | Something to do about it, under the body: a button or a link.      |
| `className`        | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |             | Added to the outer block's classes.                                |
