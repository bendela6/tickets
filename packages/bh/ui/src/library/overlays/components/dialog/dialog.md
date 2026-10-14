---
title: Dialog
summary: A modal window over the page, for a short task or a question.
related: [DialogFooter, Drawer, Popover]
---

[//]: # 'written from dialog.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Dialog

A modal window over the page, for a short task or a question.

Build one from its parts, or take `ConfirmDialog`, which puts them
together for a question with a cancel button and a confirm button. To
ask from code and await the answer, in place of `window.confirm()`,
take `useConfirm`.

## Import

```tsx
import {
  ConfirmDialog,
  ConfirmProvider,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
  useConfirm,
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

When `onConfirm` returns a promise, the dialog waits for it. The confirm
button shows a spinner, and nothing closes the dialog until the promise
settles, Esc and the cancel button included: the work can't be called
back, so the dialog stays to say how it went. It closes when the promise
resolves. When it rejects, or `onConfirm` throws, the error's message
shows above the buttons and the dialog stays open, to try again or
cancel; `describeError` puts a failure in words of your own. This one
fails the first time.

**Waits for its action**

```tsx
import { useRef, useState } from 'react';
import { Button, ConfirmDialog } from '@bh/ui';

// Stands in for a request: it takes a second, and fails the first time.
function deleteOnServer(attempt: number) {
  return new Promise<void>((resolve, reject) => {
    setTimeout(() => {
      if (attempt === 1) {
        reject(new Error('The server did not answer. Try again.'));
      } else {
        resolve();
      }
    }, 1200);
  });
}

export function WaitsForItsAction() {
  const [open, setOpen] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const attempts = useRef(0);
  return (
    <div className="flex items-center gap-12">
      <Button
        tone="danger"
        disabled={deleted}
        onClick={() => {
          attempts.current = 0;
          setOpen(true);
        }}
      >
        Delete archive.zip
      </Button>
      {deleted ? <span className="text-13 text-gray-11">Deleted</span> : null}
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete archive.zip?"
        body="The file is removed from the server."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          attempts.current += 1;
          await deleteOnServer(attempts.current);
          setDeleted(true);
        }}
      />
    </div>
  );
}
```

`children` are a body of your own, under `body` and above the buttons:
a choice that changes what the confirm does, or a list of what it
touches. They are laid out as you lay them out, 16 pixels under the
sentence above. Here the choice changes the confirm button too.

**A body of its own**

```tsx
import { useState } from 'react';
import { Button, Checkbox, ConfirmDialog } from '@bh/ui';

export function ABodyOfItsOwn() {
  const [open, setOpen] = useState(false);
  const [alsoFiles, setAlsoFiles] = useState(false);
  const [done, setDone] = useState('');
  return (
    <div className="flex items-center gap-12">
      <Button
        onClick={() => {
          setAlsoFiles(false);
          setOpen(true);
        }}
      >
        Remove Holiday photos
      </Button>
      {done ? <span className="text-13 text-gray-11">{done}</span> : null}
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Remove Holiday photos?"
        body="The folder leaves the library. Its 24 files stay on the disk unless you say otherwise."
        confirmLabel={alsoFiles ? 'Remove and delete' : 'Remove'}
        destructive={alsoFiles}
        onConfirm={() => setDone(alsoFiles ? 'Removed, files deleted' : 'Removed')}
      >
        <Checkbox label="Also delete the 24 files" value={alsoFiles} onChange={setAlsoFiles} />
      </ConfirmDialog>
    </div>
  );
}
```

For what can't be undone, `phrase` asks for a word to be typed first,
so a stray click can't do it: the confirm button stays disabled until
the field holds the phrase exactly, case and spaces included, and Enter
in the field confirms once it does. The field takes focus as the dialog
opens and starts empty at each opening. Its label reads "Type
`photo-archive` to confirm"; `phraseLabel` says it otherwise.

**Type to confirm**

```tsx
import { useState } from 'react';
import { Button, ConfirmDialog } from '@bh/ui';

export function TypeToConfirm() {
  const [open, setOpen] = useState(false);
  const [deleted, setDeleted] = useState(false);
  return (
    <div className="flex items-center gap-12">
      <Button tone="danger" disabled={deleted} onClick={() => setOpen(true)}>
        Delete photo-archive
      </Button>
      {deleted ? <span className="text-13 text-gray-11">Deleted</span> : null}
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete photo-archive?"
        body="Its 1,204 files and every share link to them are deleted. This can't be undone."
        phrase="photo-archive"
        confirmLabel="Delete project"
        destructive
        onConfirm={async () => {
          await new Promise((resolve) => setTimeout(resolve, 800));
          setDeleted(true);
        }}
      />
    </div>
  );
}
```

### Asking from code

`useConfirm` asks from code, where `window.confirm()` would: `await
confirm({ title, … })` opens a ConfirmDialog and answers `true` once it
is confirmed, or `false` when it is cancelled. It takes the dialog's
own options, `onConfirm` and `phrase` among them; with an `onConfirm`,
it answers `true` only once that has worked, and a failure shows in the
dialog as it would in ConfirmDialog.

Put one `ConfirmProvider` around the app, as you would a
[ToastProvider](../../../feedback/components/toast/toast.md): the dialog is drawn there,
one question at a time, and an ask made while another is open waits
for it to close. Being drawn there, a body passed as `children` sees
the provider's context rather than the caller's; for a body that needs
the caller's, or a choice whose value the confirm reads, render a
ConfirmDialog yourself.

**Asking from code**

```tsx
import { useState } from 'react';
import { Button, ConfirmProvider, useConfirm } from '@bh/ui';

function FileActions() {
  const { confirm } = useConfirm();
  const [said, setSaid] = useState('');
  return (
    <div className="flex items-center gap-12">
      <Button
        onClick={async () => {
          const ok = await confirm({
            title: 'Discard your changes to notes.txt?',
            confirmLabel: 'Discard',
          });
          setSaid(ok ? 'Changes discarded' : 'Changes kept');
        }}
      >
        Discard changes
      </Button>
      <Button
        tone="danger"
        onClick={async () => {
          const ok = await confirm({
            title: 'Empty the bin?',
            body: 'Its 38 files are deleted for good.',
            phrase: 'empty',
            confirmLabel: 'Empty the bin',
            destructive: true,
            onConfirm: () => new Promise((resolve) => setTimeout(resolve, 800)),
          });
          setSaid(ok ? 'Bin emptied' : 'Bin kept');
        }}
      >
        Empty the bin
      </Button>
      {said ? <span className="text-13 text-gray-11">{said}</span> : null}
    </div>
  );
}

export function AskingFromCode() {
  return (
    <ConfirmProvider>
      <FileActions />
    </ConfirmProvider>
  );
}
```

## Keyboard and accessibility

| Key                | Does                                                                       |
| ------------------ | -------------------------------------------------------------------------- |
| `Enter` or `Space` | On the trigger, opens the dialog.                                          |
| `Enter`            | In a ConfirmDialog's phrase field, confirms once the phrase is typed.      |
| `Tab`              | Moves to the next control in the dialog; from the last, back to the first. |
| `Shift+Tab`        | Moves to the previous control in the dialog; from the first, to the last.  |
| `Esc`              | Closes the dialog, unless a ConfirmDialog is waiting for its onConfirm.    |

`DialogContent` has the `dialog` role, named by `DialogTitle` and
described by `DialogDescription` when there is one. While it is open,
focus stays inside it, the page behind is hidden from assistive
technology and takes no pointer events, and a click on the dim closes
it.

Opening moves focus to the first control inside; in `ConfirmDialog`,
the phrase field when it asks for one, else the first control in its
`children`, else the cancel button. Closing gives focus back to
whatever had it as the dialog opened: `DialogTrigger`, or the row or
button that set `open` or called `confirm`, which is how
`ConfirmDialog` always opens. If that has left the page or
can no longer take focus, focus goes to `DialogTrigger`, then to the
nearest thing still on the page that held it, like the drawer a dialog
was opened from. If something else has focus by then, it keeps it.

[`useRestoreFocus`](#userestorefocus) does this, for Drawer and
SidePanel too, and for a surface of your own.

While `ConfirmDialog` waits for `onConfirm`, its buttons are disabled
and the confirm button is marked busy, so focus moves to the dialog
itself rather than out of it. A failure is announced as an alert, and
focus goes back where it was as the wait began: on the confirm button
that was pressed, to try again.

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

| Prop                      | Type                            | Default     | Description                                                                                                                                                                                                                                                                 |
| ------------------------- | ------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `open` (required)         | `boolean`                       |             | Whether the dialog is open.                                                                                                                                                                                                                                                 |
| `onOpenChange` (required) | `(open: boolean) => void`       |             | Called with `false` when it closes: by the cancel button, Esc or a click on the dim, and when `onConfirm` is done. Never while `onConfirm` runs.                                                                                                                            |
| `title` (required)        | `ReactNode`                     |             | The question, as the dialog's title.                                                                                                                                                                                                                                        |
| `body`                    | `ReactNode`                     |             | A sentence under the title, as the dialog's description.                                                                                                                                                                                                                    |
| `children`                | `ReactNode`                     |             | A body of your own, under `body` and above the buttons: a choice that changes what the confirm does, a list of what it touches.                                                                                                                                             |
| `confirmLabel`            | `string`                        | `'Confirm'` | The confirm button's label.                                                                                                                                                                                                                                                 |
| `cancelLabel`             | `string`                        | `'Cancel'`  | The cancel button's label.                                                                                                                                                                                                                                                  |
| `destructive`             | `boolean`                       |             | Paints the confirm button in the `danger` tone instead of `primary`.                                                                                                                                                                                                        |
| `phrase`                  | `string`                        |             | A phrase to type before confirming, for what can't be undone: a field asks for it, and the confirm button stays disabled until the field holds exactly this, case and spaces included.                                                                                      |
| `phraseLabel`             | `ReactNode`                     |             | The phrase field's label: by default "Type `phrase` to confirm".                                                                                                                                                                                                            |
| `onConfirm` (required)    | `() => unknown`                 |             | Called when the confirm button is pressed. Return a promise and the dialog waits, busy, and closes when it resolves; return anything else and it closes at once. If the promise rejects, or this throws, the dialog shows the error and stays open, to try again or cancel. |
| `describeError`           | `(error: unknown) => ReactNode` |             | What the dialog says when `onConfirm` fails: by default the error's own message.                                                                                                                                                                                            |

### ConfirmProvider

| Prop                  | Type        | Default | Description                                          |
| --------------------- | ----------- | ------- | ---------------------------------------------------- |
| `children` (required) | `ReactNode` |         | The part of the app that can ask: usually all of it. |

### useConfirm

```ts
useConfirm(): Confirm
```

Returns `confirm`, which asks a question in a ConfirmDialog and answers
whether it was confirmed: an ask to await, in place of `window.confirm()`.
Throws outside a `ConfirmProvider`.

Returns `Confirm`: `{ confirm }`, where `await confirm({ title, … })` is `true` or `false`.

```ts
interface Confirm
```

What `useConfirm` returns.

| Member               | Type                                            | Default | Description                                                                                                                                                                      |
| -------------------- | ----------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `confirm` (required) | `(options: ConfirmOptions) => Promise<boolean>` |         | Opens a ConfirmDialog and answers `true` once it is confirmed, and its `onConfirm` has worked, or `false` when it is cancelled: by the cancel button, Esc or a click on the dim. |

```ts
interface ConfirmOptions extends Omit< ConfirmDialogProps, 'open' | 'onOpenChange' | 'onConfirm' >
```

What `confirm` asks: ConfirmDialog's props, less the three the provider
holds. `onConfirm` is optional here, since the answer is often all a
caller needs.

| Member             | Type                            | Default | Description                                                                                                                                                                                                     |
| ------------------ | ------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title` (required) | `ReactNode`                     |         | The question, as the dialog's title.                                                                                                                                                                            |
| `body`             | `ReactNode`                     |         | A sentence under the title, as the dialog's description.                                                                                                                                                        |
| `children`         | `ReactNode`                     |         | A body of your own, under `body` and above the buttons: a choice that changes what the confirm does, a list of what it touches.                                                                                 |
| `confirmLabel`     | `string`                        |         | The confirm button's label.                                                                                                                                                                                     |
| `cancelLabel`      | `string`                        |         | The cancel button's label.                                                                                                                                                                                      |
| `destructive`      | `boolean`                       |         | Paints the confirm button in the `danger` tone instead of `primary`.                                                                                                                                            |
| `phrase`           | `string`                        |         | A phrase to type before confirming, for what can't be undone: a field asks for it, and the confirm button stays disabled until the field holds exactly this, case and spaces included.                          |
| `phraseLabel`      | `ReactNode`                     |         | The phrase field's label: by default "Type `phrase` to confirm".                                                                                                                                                |
| `describeError`    | `(error: unknown) => ReactNode` |         | What the dialog says when `onConfirm` fails: by default the error's own message.                                                                                                                                |
| `onConfirm`        | `() => unknown`                 |         | Run when the confirm button is pressed, as ConfirmDialog runs it: a promise keeps the dialog open, busy, until it settles, and a failure shows in the dialog. `confirm` answers `true` only once it has worked. |

### useRestoreFocus

```ts
useRestoreFocus(options?: RestoreFocusOptions): RestoreFocus
```

Gives focus back to what had it when a surface opened, once the surface
closes: to the opener if it is still on the page and takes focus, else to
`fallback`, else to the nearest thing still on the page that held the
opener. It does nothing when something already has focus by then.

Without `open`, Radix runs the surface: hand `onFocus` and
`onCloseAutoFocus` to its Content. With `open`, the hook runs it by
itself. Dialog and Drawer are the first kind, SidePanel the second.

| Parameter                 | Type                                     | Default | Description                                                                                                                                                                                                                                                                        |
| ------------------------- | ---------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `options`                 | `RestoreFocusOptions`                    | `{}`    |                                                                                                                                                                                                                                                                                    |
| `options.open`            | `boolean`                                |         | Whether the surface is open, for a surface Radix does not run. The hook then remembers what has focus as it turns true, and gives focus back as it turns false or the surface unmounts open. Leave it out for a Radix surface, and hand its Content the handlers the hook returns. |
| `options.rememberOnMount` | `boolean`                                | `true`  | Whether a surface that mounts already open was opened by what had focus then: true for one a click renders, like a drawer a row mounts; false for a panel the page lays out open, which nothing opened. Only with `open`.                                                          |
| `options.fallback`        | `() => HTMLElement \| null \| undefined` |         | Where focus goes when the opener has left the page or can no longer take it: the surface's own way back, like the button that reopens it. Asked as the surface closes, so it can be an element the close rendered.                                                                 |

Returns `RestoreFocus`.

```ts
interface RestoreFocus
```

What `useRestoreFocus` returns: the two handlers a Radix surface hands its Content.

| Member                        | Type                          | Default | Description                                                                             |
| ----------------------------- | ----------------------------- | ------- | --------------------------------------------------------------------------------------- |
| `onFocus` (required)          | `(event: FocusEvent) => void` |         | The Content's `onFocus`: the first time focus enters, remembers where it came from.     |
| `onCloseAutoFocus` (required) | `(event: Event) => void`      |         | The Content's `onCloseAutoFocus`: once the content has left the page, gives focus back. |
