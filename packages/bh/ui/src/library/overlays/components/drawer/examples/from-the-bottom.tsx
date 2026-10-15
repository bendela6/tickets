import { useState } from 'react';
import { Button, Drawer, DrawerControls } from '@bh/ui';

export function FromTheBottom() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open a sheet</Button>
      <Drawer open={open} onOpenChange={setOpen} side="bottom" label="Sort by">
        <div className="flex shrink-0 items-center gap-8 px-16 pt-12 pb-8">
          <span className="text-14 font-500 flex-1">Sort by</span>
          <DrawerControls />
        </div>
        <p className="text-13/19 text-gray-11 overflow-y-auto px-16 pb-24">
          As wide as the window and as tall as what it holds, up to 48 pixels short of the top.
        </p>
      </Drawer>
    </>
  );
}
