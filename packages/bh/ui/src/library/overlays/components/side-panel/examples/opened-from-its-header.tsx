import { useState } from 'react';
import { Button, SidePanel } from '@bh/ui';

export function OpenedFromItsHeader() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex h-screen flex-col">
      <div className="border-gray-6 flex items-center justify-between border-b-1 p-8">
        <span className="text-14 font-600">Map</span>
        <Button size="sm" aria-expanded={open} onClick={() => setOpen(!open)}>
          Layers
        </Button>
      </div>
      <div className="flex min-h-0 flex-1">
        <SidePanel
          label="Layers"
          collapsible
          overlayBelow="md"
          reopenButton={false}
          open={open}
          onOpenChange={setOpen}
        >
          <div className="text-13/19 flex flex-col gap-4 p-12">
            <span>Roads</span>
            <span>Rivers</span>
            <span>Contours</span>
          </div>
        </SidePanel>
        <div className="text-13/19 text-gray-11 flex-1 p-12">Content</div>
      </div>
    </div>
  );
}
