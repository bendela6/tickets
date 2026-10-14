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
