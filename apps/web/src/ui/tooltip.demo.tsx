import { Button } from './button';
import { Tooltip } from './tooltip';

function TooltipFixture() {
  return (
    <Tooltip content="Create a ticket · ⌘N">
      <Button variant="secondary">Hover me</Button>
    </Tooltip>
  );
}

export const meta = { title: 'Tooltip', group: 'Overlays' };

export const states = [{ name: 'hover', render: () => <TooltipFixture /> }];
