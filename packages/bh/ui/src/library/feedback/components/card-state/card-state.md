---
title: CardState
summary: 'A loading card in its four states: waiting, failed, empty, and its content.'
related: [Card, ScreenState, Spinner]
---

[//]: # 'written from card-state.doc.yaml by pnpm docs:sync; edit that file, not this one'

# CardState

A loading card in its four states: waiting, failed, empty, and its
content.

It goes in a `CardBody`, around what the card shows once its answer has
come, so every card waits, fails and comes up empty the same way. It
works outside a card too, around anything that loads.

## Import

```tsx
import { CardState } from '@bh/ui';
```

## Examples

`isLoading` shows a spinner until the first answer. `error` shows its
message under "Could not load": anything thrown is taken, as a query
library hands it over, and one that isn't an `Error` says the request
failed. `isEmpty` shows `emptyText`, "Nothing here." unless it says
otherwise. With none of them, the content shows, in a column 16 pixels
apart.

An error shows over the spinner, so a failed answer that is being retried
still says it failed.

**Its four states**

```tsx
import { useState } from 'react';
import { Card, CardBody, CardHeader, CardState, CardTitle, SegmentedControl } from '@bh/ui';

const STATES = [
  { value: 'loading', label: 'Loading' },
  { value: 'error', label: 'Error' },
  { value: 'empty', label: 'Empty' },
  { value: 'answer', label: 'Answer' },
];

export function ItsFourStates() {
  const [state, setState] = useState('answer');
  return (
    <div className="flex w-320 flex-col gap-12">
      <SegmentedControl label="State" options={STATES} value={state} onChange={setState} />
      <Card>
        <CardHeader>
          <CardTitle>Uploads</CardTitle>
        </CardHeader>
        <CardBody>
          <CardState
            isLoading={state === 'loading'}
            error={state === 'error' ? new Error('The server did not answer in 5 s.') : null}
            isEmpty={state === 'empty'}
            emptyText="Nothing is uploading"
          >
            <p className="text-13/19 text-gray-11">3 files uploading, 12 MB left.</p>
            <p className="text-13/19 text-gray-11">
              The content sits in a column, 16 pixels apart.
            </p>
          </CardState>
        </CardBody>
      </Card>
    </div>
  );
}
```

A partial answer, where one source did not reply, is still the content:
the numbers that came show, with the note last. `gap` spaces the column
in steps of 4 pixels, 4 (16 pixels) by default.

**A partial answer**

```tsx
import { Card, CardBody, CardHeader, CardState, CardTitle, Icon } from '@bh/ui';

export function APartialAnswer() {
  return (
    <Card className="w-320">
      <CardHeader>
        <CardTitle>Uploads</CardTitle>
      </CardHeader>
      <CardBody>
        <CardState gap={3}>
          <p className="text-13/19 text-gray-11">3 files uploading, 12 MB left.</p>
          <p role="status" className="text-12/17 text-orange-11 flex items-start gap-6">
            <Icon name="triangle-alert" size="sm" className="mt-2 shrink-0" />
            <span>The mirror did not answer: its speeds are missing.</span>
          </p>
        </CardState>
      </CardBody>
    </Card>
  );
}
```

## Keyboard and accessibility

The spinner sits in a `status` region and is named "Loading". The error
and the empty line are plain text, read in place: neither is announced
when it appears.

## Props

| Prop                  | Type                                     | Default           | Description                                                                                                                                                     |
| --------------------- | ---------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `isLoading`           | `boolean`                                | `false`           | No answer yet: shows a spinner in place of the content.                                                                                                         |
| `error`               | `unknown`                                |                   | The request failed: shows its message in place of the content. Anything thrown is taken, as a query library hands it over; `null` and `undefined` are no error. |
| `isEmpty`             | `boolean`                                | `false`           | The answer came and holds nothing to show: `emptyText` stands in for the content.                                                                               |
| `emptyText`           | `string`                                 | `'Nothing here.'` | What an empty answer says.                                                                                                                                      |
| `gap`                 | `Gap`: `0`, `1`, `2`, `3`, `4`, `6`, `8` | `4`               | Space between the content's parts, in steps of 4 pixels.                                                                                                        |
| `children` (required) | `ReactNode`                              |                   | The content, in a column. A note on a partial answer (a source that did not reply) goes last, so it shows with the numbers that did come.                       |
