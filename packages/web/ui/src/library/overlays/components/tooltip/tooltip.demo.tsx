import { definePlayground, text, select } from '../../../../gallery';
import { Button } from '../../../primitives/components/button';
import { Tooltip } from './tooltip';

function TooltipFixture() {
  return (
    <Tooltip content="Create a ticket · ⌘N">
      <Button variant="outline">Hover me</Button>
    </Tooltip>
  );
}

function TooltipPlaygroundFixture({
  content,
  side,
}: {
  content: string;
  side: 'top' | 'right' | 'bottom' | 'left' | undefined;
}) {
  return (
    <Tooltip content={content} side={side}>
      <Button variant="outline">Hover me</Button>
    </Tooltip>
  );
}

export const meta = { title: 'Tooltip', group: 'Components', size: 'sm' };

export const states = [{ name: 'hover', render: () => <TooltipFixture /> }];

export const playground = definePlayground({
  controls: {
    content: text('Create a ticket · ⌘N'),
    side: select(['top', 'right', 'bottom', 'left'], { allowNone: true }),
  },
  render: (v) => <TooltipPlaygroundFixture {...v} />,
});
