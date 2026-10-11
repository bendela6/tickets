import { useState } from 'react';
import { Button, Drawer, DrawerControls } from '@bh/ui';

export function NarrowWindow() {
  const [open, setOpen] = useState(false);
  return (
    <div className="p-16">
      <Button onClick={() => setOpen(true)}>Open</Button>
      <Drawer open={open} onOpenChange={setOpen} label="Details">
        <div className="border-gray-6 flex shrink-0 items-center gap-8 border-b-1 px-16 py-12">
          <span className="text-14 font-500 flex-1">Details</span>
          <DrawerControls />
        </div>
        <p className="text-13/19 text-gray-11 flex-1 overflow-y-auto px-16 py-12">
          The strip on the left is left to tap.
        </p>
      </Drawer>
    </div>
  );
}
