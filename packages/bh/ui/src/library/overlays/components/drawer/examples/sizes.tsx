import { useState } from 'react';
import { Button, DRAWER_SIZES, Drawer, DrawerControls, type DrawerSize } from '@bh/ui';

function SizedDrawer({ size }: { size: DrawerSize }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>{size}</Button>
      <Drawer open={open} onOpenChange={setOpen} size={size} label={`Size ${size}`}>
        <div className="flex shrink-0 justify-end px-8 py-8">
          <DrawerControls />
        </div>
        <p className="text-13/19 text-gray-11 px-16">{DRAWER_SIZES[size]} pixels wide.</p>
      </Drawer>
    </>
  );
}

export function Sizes() {
  return (
    <div className="flex gap-8">
      <SizedDrawer size="sm" />
      <SizedDrawer size="md" />
      <SizedDrawer size="lg" />
    </div>
  );
}
