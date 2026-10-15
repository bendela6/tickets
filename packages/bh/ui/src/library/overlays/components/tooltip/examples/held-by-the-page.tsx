import { useState } from 'react';
import { Button, Switch, Tooltip } from '@bh/ui';

export function HeldByThePage() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center gap-24">
      <Tooltip
        content="Saved two minutes ago"
        side="bottom"
        align="start"
        open={open}
        onOpenChange={setOpen}
      >
        <Button>Save</Button>
      </Tooltip>
      <Switch label="Show the hint" value={open} onChange={setOpen} />
    </div>
  );
}
