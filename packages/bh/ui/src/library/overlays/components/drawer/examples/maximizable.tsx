import { useState } from 'react';
import { Button, Drawer, DrawerControls } from '@bh/ui';

export function Maximizable() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open preview</Button>
      <Drawer
        open={open}
        onOpenChange={setOpen}
        size="lg"
        maximizable
        storageKey="preview-drawer"
        label="Preview"
      >
        <div className="border-gray-6 flex shrink-0 items-center gap-8 border-b-1 px-16 py-12">
          <span className="text-14 font-500 flex-1">Preview</span>
          <DrawerControls />
        </div>
        <p className="text-13/19 text-gray-11 flex-1 overflow-y-auto px-16 py-12">
          Resize or maximize it, close it, and open it again.
        </p>
      </Drawer>
    </>
  );
}
