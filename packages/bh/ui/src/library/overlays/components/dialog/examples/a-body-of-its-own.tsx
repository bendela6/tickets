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
