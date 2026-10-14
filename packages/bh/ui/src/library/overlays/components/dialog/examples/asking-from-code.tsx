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
