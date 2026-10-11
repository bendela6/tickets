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
