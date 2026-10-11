---
title: Toast
summary: A short message in the corner of the screen that goes away on its own.
related: [ScreenState, Button, Drawer]
---

[//]: # 'written from toast.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Toast

A short message in the corner of the screen that goes away on its own.

Put one `ToastProvider` around the app, and show a toast from anywhere
inside it with `useToast`. A toast closes after 4 seconds, and the timer
waits while the pointer or focus is on the toasts.

## Import

```tsx
import { ToastProvider, useToast } from '@bh/ui';
```

## Examples

`toast` takes a `title`, the message. Toasts stack in the bottom-right
corner, newest last.

**Showing toasts**

```tsx
import { Button, ToastProvider, useToast } from '@bh/ui';

function SaveButton() {
  const { toast } = useToast();
  return <Button onClick={() => toast({ title: 'File saved' })}>Save</Button>;
}

export function ShowingToasts() {
  return (
    <ToastProvider>
      <SaveButton />
    </ToastProvider>
  );
}
```

An `action` adds a button beside the message. Clicking it runs `onClick`
and closes the toast.

**With an action**

```tsx
import { useState } from 'react';
import { Button, ToastProvider, useToast } from '@bh/ui';

function ArchiveButton() {
  const { toast } = useToast();
  const [archived, setArchived] = useState(false);
  return (
    <Button
      variant="outline"
      disabled={archived}
      onClick={() => {
        setArchived(true);
        toast({
          title: 'notes.txt archived',
          action: { label: 'Undo', onClick: () => setArchived(false) },
        });
      }}
    >
      {archived ? 'Archived' : 'Archive notes.txt'}
    </Button>
  );
}

export function WithAnAction() {
  return (
    <ToastProvider>
      <ArchiveButton />
    </ToastProvider>
  );
}
```

## Keyboard and accessibility

| Key                  | Does                                        |
| -------------------- | ------------------------------------------- |
| `F8`                 | Moves focus to the toasts.                  |
| `Tab` or `Shift+Tab` | Moves between the toasts and their actions. |
| `Enter` or `Space`   | On an action, runs it and closes the toast. |
| `Esc`                | Closes the focused toast.                   |

Each toast is announced as it appears, through a `status` region, with
its action named by its label. The toasts are a region named
"Notifications (F8)". A swipe to the right dismisses one.

A toast shown from inside a modal [Drawer](../../../overlays/components/drawer/drawer.md)
or [Dialog](../../../overlays/components/dialog/dialog.md) stays clickable, and stays
visible to a screen reader, though the modal hides the rest of the page
from both.

## Props

### ToastProvider

| Prop                  | Type        | Default | Description                                                   |
| --------------------- | ----------- | ------- | ------------------------------------------------------------- |
| `children` (required) | `ReactNode` |         | The part of the app that can show a toast: usually all of it. |

### useToast

```ts
useToast(): ToastContextValue
```

Returns `toast`, which shows a toast. Throws outside a `ToastProvider`.

Returns `ToastContextValue`: `toast({ title, action })`: `title` is the message, and `action`, if
given, a button beside it as `{ label, onClick }`.
