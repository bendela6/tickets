import { useState } from 'react';
import { Button } from '../button';
import { Drawer, DrawerControls } from './drawer';

export const meta = {
  title: 'Drawer',
  group: 'Components',
  size: 'lg',
  impl: ['./drawer.tsx'],
};

function DrawerDemo({ side, maximizable }: { side: 'left' | 'right'; maximizable?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Open {side}
      </Button>
      <Drawer
        open={open}
        onOpenChange={setOpen}
        side={side}
        size="md"
        maximizable={maximizable}
        label="Demo drawer"
      >
        <div className="flex shrink-0 items-center gap-8 border-b-1 border-gray-6 px-16 py-12">
          <span className="flex-1 font-sans text-14 font-500 text-gray-12">Demo drawer</span>
          <DrawerControls />
        </div>
        <div className="flex-1 overflow-y-auto px-16 py-12 font-sans text-13/19 text-gray-11">
          Drag the inner edge to resize. Esc closes.
        </div>
      </Drawer>
    </>
  );
}

export const states = [
  { name: 'right', render: () => <DrawerDemo side="right" /> },
  { name: 'left', render: () => <DrawerDemo side="left" /> },
  { name: 'maximizable', render: () => <DrawerDemo side="right" maximizable /> },
];
