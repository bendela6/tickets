import { useState } from 'react';
import { Button } from './button';
import { ConfirmDialog } from './dialog';

function DialogFixture() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Open dialog
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Archive this ticket?"
        body="It moves to the archive and leaves the board. You can restore it anytime."
        confirmLabel="Archive"
        destructive
        onConfirm={() => undefined}
      />
    </>
  );
}

export const meta = { title: 'Dialog', group: 'Overlays' };

export const states = [{ name: 'confirm dialog', render: () => <DialogFixture /> }];
