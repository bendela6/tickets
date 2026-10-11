---
title: CopyButton
summary: Copies a string to the clipboard and says whether it worked.
related: [Button, JsonViewer]
---

[//]: # 'written from copy-button.doc.yaml by pnpm docs:sync; edit that file, not this one'

# CopyButton

Copies a string to the clipboard and says whether it worked.

After a click the label turns to `copiedLabel`, with a check, or to
`failedLabel` when the clipboard refuses the write. After `resetMs` it
returns to `label`.

## Import

```tsx
import { CopyButton } from '@bh/ui';
```

## Examples

`value` is the exact string written. The labels default to Copy, Copied
and Failed.

**Copy a link**

```tsx
import { CopyButton } from '@bh/ui';

export function CopyALink() {
  return <CopyButton value="https://example.com/files/report.pdf" />;
}
```

Name what it copies when the button is not next to it.

**Custom labels**

```tsx
import { CopyButton } from '@bh/ui';

export function CustomLabels() {
  return (
    <div className="flex items-center gap-12">
      <CopyButton value="npm install @bh/ui" label="Copy install command" copiedLabel="Copied!" />
      <CopyButton
        value="https://example.com/files/report.pdf"
        label="Copy link"
        copiedLabel="Link copied"
        failedLabel="Could not copy"
      />
    </div>
  );
}
```

`useCopy` is the same behaviour without the button, for a control of your
own.

**Without the button**

```tsx
import { Button, useCopy } from '@bh/ui';

function labelFor(copied: boolean, failed: boolean) {
  if (copied) {
    return 'Copied';
  }
  return failed ? 'Could not copy' : 'Copy the city';
}

export function WithoutTheButton() {
  const { copy, copied, failed } = useCopy();
  return (
    <Button variant="subtle" onClick={() => void copy('Lisbon')}>
      {labelFor(copied, failed)}
    </Button>
  );
}
```

```ts
useCopy(resetMs?: number): { copied: boolean; failed: boolean; copy: (text: string) => Promise<void>; }
```

CopyButton's behaviour without its button: `copy(text)`, then `copied` or `failed` until `resetMs` passes.

| Parameter | Type     | Default | Description                                           |
| --------- | -------- | ------- | ----------------------------------------------------- |
| `resetMs` | `number` | `1500`  | How long `copied` or `failed` holds, in milliseconds. |

Returns `{ copied: boolean; failed: boolean; copy: (text: string) => Promise<void>; }`.

## Keyboard and accessibility

| Key                | Does              |
| ------------------ | ----------------- |
| `Enter` or `Space` | Copies the value. |

It is a `<button type="button">`, and its name is whichever label is
showing, so the name changes with the state; there is no live region. The
icon is hidden from assistive tech.

## Props

| Prop               | Type        | Default    | Description                                                                                 |
| ------------------ | ----------- | ---------- | ------------------------------------------------------------------------------------------- |
| `value` (required) | `string`    |            | The exact string written to the clipboard.                                                  |
| `label`            | `ReactNode` | `'Copy'`   | The resting label. Name the thing when the button is not next to it.                        |
| `copiedLabel`      | `ReactNode` | `'Copied'` | Shown after a successful write, until `resetMs` passes.                                     |
| `failedLabel`      | `ReactNode` | `'Failed'` | Shown when the clipboard write is refused, until `resetMs` passes.                          |
| `resetMs`          | `number`    | `1500`     | How long the copied or failed label holds, in milliseconds, before the resting one returns. |
| `className`        | `string`    |            | Added to the button's own classes.                                                          |
