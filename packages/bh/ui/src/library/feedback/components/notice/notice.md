---
title: Notice
summary: 'A box with a tone for a message on a page: a note, information, a
  success, a warning or an error.'
related: [Toast, ScreenState, FieldError, Pill]
---

[//]: # 'written from notice.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Notice

A box with a tone for a message on a page: a note, information, a
success, a warning or an error.

It stays where it is put until the page takes it away. `tone` says what
the message is, in a tinted fill and a glyph of its own, and a notice
rests on `neutral`. A title, the message and actions are each optional.

## Import

```tsx
import { Notice } from '@bh/ui';
```

## Examples

`tone` takes bh's role names. `neutral` is a note in passing, `primary`
information in the accent, `success` that something worked, `warning`
that something needs care, and `danger` an error. Each draws its own
glyph as well as its colour, so a reader who can't tell red from green
can still tell an error from a success.

`size` sets the type, padding and glyph together: 12, 13 and 15 pixel
type. `sm` fits a dense panel and `lg` a screen read at arm's length,
such as a phone at a counter.

Every combination of `Notice`'s `tone` and `size`, with `children="The next sync runs at 14:00."`:

- `tone` (rows): `primary`, `success`, `warning`, `danger`, `neutral`
- `size` (columns): `sm`, `md`, `lg`

`title` is a line in bold above the message. Either can stand alone.

**A title and a message**

```tsx
import { Notice, Stack } from '@bh/ui';

export function ATitleAndAMessage() {
  return (
    <Stack gap={3}>
      <Notice>qBittorrent has queueing off, so downloads have no order to change.</Notice>
      <Notice tone="warning" title="Coupon used">
        It was used on 3 March, so it cannot be used again.
      </Notice>
      <Notice tone="success" title="Reward ready" />
    </Stack>
  );
}
```

`action` goes under the message: a button, a link, or a few of them.

**With an action**

```tsx
import { Button, Notice, Stack } from '@bh/ui';

export function WithAnAction() {
  return (
    <Stack gap={3}>
      <Notice
        tone="danger"
        title="Could not load the builds"
        action={
          <Button size="sm" variant="outline" tone="danger">
            Try again
          </Button>
        }
      >
        The server did not answer in 30 seconds.
      </Notice>
      <Notice
        tone="primary"
        action={
          <>
            <Button size="sm" variant="solid">
              Reload
            </Button>
            <Button size="sm" variant="ghost" tone="neutral">
              Later
            </Button>
          </>
        }
      >
        A new version of this page is ready. Reload to use it; nothing you typed is lost.
      </Notice>
    </Stack>
  );
}
```

A notice that answers something the reader just did, such as a save
that failed, takes `announce`, so a screen reader says it as it
appears. Save below fails once and then works.

**After an action**

```tsx
import { useState } from 'react';
import { Button, Notice, Stack } from '@bh/ui';

type Outcome = 'none' | 'failed' | 'saved';

export function AfterAnAction() {
  const [outcome, setOutcome] = useState<Outcome>('none');
  return (
    <Stack gap={3} align="start" className="w-full max-w-480">
      <Button
        variant="solid"
        onClick={() => {
          // The first save fails and the next one works, so both notices show.
          setOutcome((last) => (last === 'failed' ? 'saved' : 'failed'));
        }}
      >
        Save
      </Button>
      {outcome === 'failed' ? (
        <Notice tone="danger" announce className="self-stretch">
          The save failed: the page changed on disk since you opened it.
        </Notice>
      ) : null}
      {outcome === 'saved' ? (
        <Notice tone="success" announce className="self-stretch">
          Saved. The page is live at /notes/today.
        </Notice>
      ) : null}
    </Stack>
  );
}
```

A string keeps its line breaks, so an error in a server's own words
keeps its lines, and a long word without spaces, such as a URL, breaks
rather than running out of the box. The message can be any element,
such as a list.

**Long messages**

```tsx
import { Notice, Stack } from '@bh/ui';

// A message from a server, in its own words and on its own lines.
const PROBLEMS = [
  'Not saved until this fits the Article kind:',
  '• title is required',
  '• summary is longer than 280 characters',
].join('\n');

export function LongMessages() {
  return (
    <Stack gap={3}>
      <Notice tone="danger">{PROBLEMS}</Notice>
      <Notice tone="warning" title="The webhook did not answer">
        https://hooks.example.com/services/T0000000/B0000000/XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
      </Notice>
      <Notice tone="danger" title="Two rules do not parse">
        <ul className="font-mono">
          <li>line 4: /articles/[id is missing a ]</li>
          <li>line 9: the pattern matches nothing</li>
        </ul>
      </Notice>
    </Stack>
  );
}
```

`icon` takes another glyph from the [Icon](../../../primitives/components/icon/icon.md)
registry, for a notice that says something more particular than its
tone. `iconLabel` names it to a screen reader.

**Another glyph**

```tsx
import { Notice } from '@bh/ui';

export function AnotherGlyph() {
  return (
    <Notice tone="warning" icon="clock" iconLabel="Wait" title="Stamped 12 minutes ago">
      The next stamp can be given at 14:00.
    </Notice>
  );
}
```

## Keyboard and accessibility

A notice has no key of its own; its actions are reached by Tab like
any others.

The glyph is an image named by the tone's word, read before the
message: "Error: The save failed." The words are English: `iconLabel`
takes the app's own.

A notice is not a live region unless it has `announce`. Most notices
are on the page from its first render, and a live region there would
read them out over whatever the reader was doing. With `announce`, a
`danger` notice is an alert (`role="alert"`) and interrupts, since the
reader is waiting on what they did; any other tone is a status
(`role="status"`) and waits for a pause. A `role` passed to the notice
wins over the one `announce` sets.

The title is a plain `div`, not a heading, so a notice never breaks the
page's outline. For a notice that names a section of its own, pass
`role="region"` and an `aria-labelledby`.

## When not to use it

- For a short message that goes away on its own, use
  [Toast](../toast/toast.md).
- For what a screen or a card shows in place of its content, such as
  an empty list or a failed load, use
  [ScreenState](../screen-state/screen-state.md).
- For what is wrong with one field's value, use the field's `error`,
  drawn by [FieldError](../../../forms/components/field-error/field-error.md) under it.

## Props

| Prop        | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Default     | Description                                                                                                                                                                                                                                                                                          |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tone`      | `NoticeTone`: `'primary'`, `'success'`, `'warning'`, `'danger'`, `'neutral'`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `'neutral'` | What it says about the message, in a colour and a glyph of its own: a note, information, a success, a warning or an error.                                                                                                                                                                           |
| `title`     | `ReactNode`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |             | A line in bold above the message.                                                                                                                                                                                                                                                                    |
| `children`  | `ReactNode`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |             | The message. A string keeps its line breaks, so an error in a server's own words keeps its lines.                                                                                                                                                                                                    |
| `action`    | `ReactNode`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |             | What to do about it, under the message: a button, a link, or a few of them.                                                                                                                                                                                                                          |
| `announce`  | `boolean`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `false`     | Announces the notice to a screen reader as it appears, for one that answers something the reader just did, such as a save that failed. A `danger` notice interrupts, as an alert; any other waits its turn, as a status. Leave it off for a notice that stands on the page: it is read in its place. |
| `icon`      | `IconName`: `'columns'`, `'filter'`, `'search'`, `'link'`, `'circle'`, `'circle-half'`, `'circle-dot'`, `'circle-dashed'`, `'circle-check'`, `'circle-x'`, `'circle-info'`, `'diamond'`, `'square'`, `'dot'`, `'arc'`, `'triangle-alert'`, `'chevron-up'`, `'chevron-down'`, `'chevron-left'`, `'chevron-right'`, `'arrow-up'`, `'arrow-down'`, `'arrow-up-right'`, `'arrow-up-down'`, `'plus'`, `'x'`, `'check'`, `'minus'`, `'maximize'`, `'minimize'`, `'copy'`, `'pencil'`, `'trash'`, `'refresh'`, `'grip'`, `'ellipsis'`, `'undo'`, `'redo'`, `'eye'`, `'rows'`, `'rows-compact'`, `'columns-2'`, `'rows-2'`, `'folder'`, `'file'`, `'terminal'`, `'sliders'`, `'calendar'`, `'clock'`, `'tag'`, `'user'`, `'lock'`, `'text-cursor'`, `'sun'`, `'moon'`, `'monitor'`, `'list'`, `'quote'` |             | A glyph from the registry in place of the tone's own.                                                                                                                                                                                                                                                |
| `iconLabel` | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |             | What a screen reader calls the glyph, before the message. Unset, it is the tone's word: Note, Info, Success, Warning or Error.                                                                                                                                                                       |
| `size`      | `NoticeSize`: `'sm'`, `'md'`, `'lg'`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `'md'`      | Type, padding and glyph together: 12, 13 and 15 pixel type. `lg` is for a screen read at arm's length, such as a phone at a counter.                                                                                                                                                                 |
| `className` | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |             | Added to the notice's own classes.                                                                                                                                                                                                                                                                   |
| `ref`       | `Ref<HTMLDivElement>`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |             | Forwarded to the `<div>`.                                                                                                                                                                                                                                                                            |

Also every `<div>` attribute (`HTMLAttributes<HTMLDivElement>`), passed through.
