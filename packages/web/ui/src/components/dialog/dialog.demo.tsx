import { useState } from 'react';
import { definePlayground, text, boolean } from '../../gallery';
import { Button } from '../button';
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

function DialogPlaygroundFixture({
  title,
  body,
  confirmLabel,
  destructive,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  destructive: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Open dialog
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        body={body}
        confirmLabel={confirmLabel}
        destructive={destructive}
        onConfirm={() => undefined}
      />
    </>
  );
}

export const meta = { title: 'Dialog', group: 'Ungrouped', size: 'sm' };

export const states = [{ name: 'confirm dialog', render: () => <DialogFixture /> }];

export const playground = definePlayground({
  controls: {
    title: text('Archive this ticket?'),
    body: text('It moves to the archive and leaves the board.'),
    confirmLabel: text('Archive'),
    destructive: boolean(true),
  },
  render: (v) => <DialogPlaygroundFixture {...v} />,
});
