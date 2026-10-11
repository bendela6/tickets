import { useState } from 'react';
import { Button, Drawer, DrawerControls } from '@bh/ui';

export function FromEitherSide() {
  const [side, setSide] = useState<'left' | 'right'>('right');
  const [open, setOpen] = useState(false);
  function openFrom(next: 'left' | 'right') {
    setSide(next);
    setOpen(true);
  }
  return (
    <div className="flex gap-8">
      <Button onClick={() => openFrom('left')}>Open left</Button>
      <Button onClick={() => openFrom('right')}>Open right</Button>
      <Drawer open={open} onOpenChange={setOpen} side={side} label="Details">
        <div className="border-gray-6 flex shrink-0 items-center gap-8 border-b-1 px-16 py-12">
          <span className="text-14 font-500 flex-1">Details</span>
          <DrawerControls />
        </div>
        <p className="text-13/19 text-gray-11 flex-1 overflow-y-auto px-16 py-12">
          Drag the inner edge to resize it. Esc closes it.
        </p>
      </Drawer>
    </div>
  );
}
