import { useState } from 'react';
import { Button, SidePanel } from '@bh/ui';

export function OpenedFromElsewhere() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-8 border-gray-6 flex h-256 flex-col overflow-hidden border-1">
      <div className="border-gray-6 flex justify-end border-b-1 p-8">
        <Button size="sm" aria-expanded={open} onClick={() => setOpen(!open)}>
          Filters
        </Button>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="text-13/19 text-gray-11 flex-1 p-12">Content</div>
        <SidePanel
          label="Filters"
          side="right"
          collapsible
          collapsedTo="none"
          open={open}
          onOpenChange={setOpen}
        >
          <div className="text-13/19 flex flex-col gap-4 p-12">
            <span>Colour</span>
            <span>Size</span>
            <span>Shape</span>
          </div>
        </SidePanel>
      </div>
    </div>
  );
}
