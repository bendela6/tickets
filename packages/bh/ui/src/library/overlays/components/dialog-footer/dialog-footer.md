---
title: DialogFooter
summary: The row of buttons at the bottom of a dialog.
related: [Dialog, Button]
---

[//]: # 'written from dialog-footer.doc.yaml by pnpm docs:sync; edit that file, not this one'

# DialogFooter

The row of buttons at the bottom of a dialog.

It lays the buttons out and leaves them to you: a hairline above, the
buttons at the right, and `cancel` before the rest. The cancel button is
yours to pass, since only your dialog knows how it closes.

## Import

```tsx
import { DialogFooter } from '@bh/ui';
```

## Examples

A ghost Cancel, then the action. In a dialog, wrap Cancel in
`DialogClose`, as [Dialog](../dialog/dialog.md) does.

**Cancel and save**

```tsx
import { Button, DialogFooter } from '@bh/ui';

export function CancelAndSave() {
  return (
    <DialogFooter cancel={<Button variant="ghost">Cancel</Button>}>
      <Button variant="solid">Save</Button>
    </DialogFooter>
  );
}
```

With one button, pass `cancel` alone for a dialog that only closes, or
`children` alone for one with a single action.

**One button**

```tsx
import { Button, DialogFooter } from '@bh/ui';

export function OneButton() {
  return (
    <div className="flex flex-col">
      <DialogFooter cancel={<Button variant="ghost">Close</Button>} />
      <DialogFooter>
        <Button variant="solid">Done</Button>
      </DialogFooter>
    </div>
  );
}
```

For something before the buttons, a hint or a field, draw the row
yourself and nest the footer in it without its border, padding and
margin: where `className` clashes with the footer's own classes, it wins.

**Hint before buttons**

```tsx
import { Button, DialogFooter } from '@bh/ui';

export function HintBeforeButtons() {
  return (
    <div className="border-gray-6 mt-16 flex items-center gap-8 border-t-1 pt-16">
      <span className="text-13 text-gray-11 flex-1">3 files selected</span>
      <DialogFooter
        className="mt-0 border-t-0 p-0"
        cancel={<Button variant="ghost">Cancel</Button>}
      >
        <Button variant="solid">Move</Button>
      </DialogFooter>
    </div>
  );
}
```

## Keyboard and accessibility

`cancel` comes first in the DOM, so Tab reaches it before the other
buttons.

## Props

| Prop        | Type        | Default | Description                                                                               |
| ----------- | ----------- | ------- | ----------------------------------------------------------------------------------------- |
| `children`  | `ReactNode` |         | The buttons after `cancel`: the dialog's action.                                          |
| `cancel`    | `ReactNode` |         | The cancel button, placed first. It is yours, since only your dialog knows how it closes. |
| `className` | `string`    |         | Classes merged onto the row; where they clash with its own, they win.                     |
