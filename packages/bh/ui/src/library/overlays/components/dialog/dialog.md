---
title: Dialog
summary: A modal window over the page, for a short task or a question.
related: [DialogFooter, Drawer, Popover]
---

[//]: # 'written from dialog.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Dialog

A modal window over the page, for a short task or a question.

Build one from its parts, or take `ConfirmDialog`, which puts them
together for a question with a cancel button and a confirm button.

## Import

```tsx
import {
  ConfirmDialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from '@bh/ui';
```

## Examples

`DialogContent` puts the window in a portal, centred over a dim: 448
pixels wide at most, and never closer than 16 pixels to the window's
sides. [DialogFooter](../dialog-footer/dialog-footer.md) lays out the
buttons, and `DialogClose` closes the dialog from one of them.
[Elevation](../../../../../docs/foundations/elevation.md) has the layers the dim and the
window sit on.

**From its parts**

```tsx
import { useState } from 'react';
import {
  Button,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
  Input,
} from '@bh/ui';

export function FromItsParts() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('notes.txt');
  return (
    <DialogRoot open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Rename</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Rename file</DialogTitle>
        <DialogDescription>Give the file a new name.</DialogDescription>
        <div className="mt-16 flex flex-col gap-6">
          <label htmlFor="file-name" className="text-12 text-gray-11">
            Name
          </label>
          <Input id="file-name" value={name} onChange={setName} />
        </div>
        <DialogFooter
          cancel={
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
          }
        >
          <Button variant="solid" onClick={() => setOpen(false)}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}
```

`ConfirmDialog` takes the question as `title` and closes after either
button, calling `onConfirm` first. `destructive` paints the confirm
button in the `danger` tone.

**Confirm before deleting**

```tsx
import { useState } from 'react';
import { Button, ConfirmDialog } from '@bh/ui';

export function ConfirmBeforeDeleting() {
  const [open, setOpen] = useState(false);
  const [deleted, setDeleted] = useState(false);
  return (
    <div className="flex items-center gap-12">
      <Button tone="danger" onClick={() => setOpen(true)}>
        Delete report.pdf
      </Button>
      {deleted ? <span className="text-13 text-gray-11">Deleted</span> : null}
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete report.pdf?"
        body="The file is removed from this folder."
        confirmLabel="Delete"
        destructive
        onConfirm={() => setDeleted(true)}
      />
    </div>
  );
}
```

## Keyboard and accessibility

| Key                | Does                                                                       |
| ------------------ | -------------------------------------------------------------------------- |
| `Enter` or `Space` | On the trigger, opens the dialog.                                          |
| `Tab`              | Moves to the next control in the dialog; from the last, back to the first. |
| `Shift+Tab`        | Moves to the previous control in the dialog; from the first, to the last.  |
| `Esc`              | Closes the dialog.                                                         |

`DialogContent` has the `dialog` role, named by `DialogTitle` and
described by `DialogDescription` when there is one. While it is open,
focus stays inside it, the page behind is hidden from assistive
technology and takes no pointer events, and a click on the dim closes
it.

Opening moves focus to the first control inside; in `ConfirmDialog`,
the cancel button. Closing returns focus to `DialogTrigger`.
`ConfirmDialog` has none, since `open` opens it, so it returns focus to
whatever had it as it opened, unless that has left the page.

## When not to use it

- For a panel at the page's edge, use [Drawer](../drawer/drawer.md).
- For a panel beside its button that leaves the page usable, use
  [Popover](../popover/popover.md).

## Props

`DialogRoot`, `DialogTrigger` and `DialogClose` are Radix's Dialog parts
as they are, so their props are Radix's.

### DialogRoot

| Prop | Type | Default | Description |
| ---- | ---- | ------- | ----------- |

Also every element attribute (`DialogProps`), passed through.

### DialogTrigger

| Prop  | Type                     | Default | Description                  |
| ----- | ------------------------ | ------- | ---------------------------- |
| `ref` | `Ref<HTMLButtonElement>` |         | Forwarded to the `<button>`. |

Also every `<button>` attribute (`ButtonHTMLAttributes<HTMLButtonElement>`), passed through.

### DialogContent

| Prop        | Type                  | Default | Description               |
| ----------- | --------------------- | ------- | ------------------------- |
| `className` | `string`              |         | Added to its own classes. |
| `children`  | `ReactNode`           |         |                           |
| `ref`       | `Ref<HTMLDivElement>` |         | Forwarded to the `<div>`. |

Also every `<div>` attribute (`DismissableLayerProps<HTMLDivElement>`), passed through.

### DialogTitle

| Prop                  | Type        | Default | Description                    |
| --------------------- | ----------- | ------- | ------------------------------ |
| `children` (required) | `ReactNode` |         | The title's text.              |
| `className`           | `string`    |         | Classes merged onto the title. |

### DialogDescription

| Prop                  | Type        | Default | Description                          |
| --------------------- | ----------- | ------- | ------------------------------------ |
| `children` (required) | `ReactNode` |         | The description's text.              |
| `className`           | `string`    |         | Classes merged onto the description. |

### DialogClose

| Prop  | Type                     | Default | Description                  |
| ----- | ------------------------ | ------- | ---------------------------- |
| `ref` | `Ref<HTMLButtonElement>` |         | Forwarded to the `<button>`. |

Also every `<button>` attribute (`ButtonHTMLAttributes<HTMLButtonElement>`), passed through.

### ConfirmDialog

| Prop                      | Type                      | Default     | Description                                                                      |
| ------------------------- | ------------------------- | ----------- | -------------------------------------------------------------------------------- |
| `open` (required)         | `boolean`                 |             | Whether the dialog is open.                                                      |
| `onOpenChange` (required) | `(open: boolean) => void` |             | Called with `false` when it closes: by either button, Esc or a click on the dim. |
| `title` (required)        | `ReactNode`               |             | The question, as the dialog's title.                                             |
| `body`                    | `ReactNode`               |             | A sentence under the title, as the dialog's description.                         |
| `confirmLabel`            | `string`                  | `'Confirm'` | The confirm button's label.                                                      |
| `cancelLabel`             | `string`                  | `'Cancel'`  | The cancel button's label.                                                       |
| `destructive`             | `boolean`                 |             | Paints the confirm button in the `danger` tone instead of `primary`.             |
| `onConfirm` (required)    | `() => void`              |             | Called when the confirm button is pressed, before the dialog closes.             |
