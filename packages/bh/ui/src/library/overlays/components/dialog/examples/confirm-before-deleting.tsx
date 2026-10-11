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
