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
