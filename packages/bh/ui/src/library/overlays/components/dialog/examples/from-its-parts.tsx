import { useState } from 'react';
import {
  Button,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
  Input,
} from '@bh/ui';

export function FromItsParts() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('notes.txt');
  return (
    <DialogRoot open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Rename</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Rename file</DialogTitle>
        <DialogDescription>Give the file a new name.</DialogDescription>
        <div className="mt-16 flex flex-col gap-6">
          <label htmlFor="file-name" className="text-12 text-gray-11">
            Name
          </label>
          <Input id="file-name" value={name} onChange={setName} />
        </div>
        <DialogFooter
          cancel={
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
          }
        >
          <Button variant="solid" onClick={() => setOpen(false)}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}
