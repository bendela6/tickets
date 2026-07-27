import { useState } from 'react';
import { definePlayground, select } from '../../gallery';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Button } from '../button';

function PopoverPlaygroundFixture({
  side,
  align,
}: {
  side: 'top' | 'right' | 'bottom' | 'left' | undefined;
  align: 'start' | 'center' | 'end' | undefined;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline">Open popover</Button>
      </PopoverTrigger>
      <PopoverContent side={side} align={align}>
        <p className="font-sans text-ui text-gray-12">Anchored content.</p>
      </PopoverContent>
    </Popover>
  );
}

export const meta = { title: 'Popover', group: 'Components', size: 'md' };

export const states = [
  {
    name: 'basic',
    render: () => (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline">Open popover</Button>
        </PopoverTrigger>
        <PopoverContent>
          <p className="font-sans text-ui text-gray-12">Anchored content.</p>
        </PopoverContent>
      </Popover>
    ),
  },
];

export const playground = definePlayground({
  controls: {
    side: select(['top', 'right', 'bottom', 'left'], { allowNone: true }),
    align: select(['start', 'center', 'end'], { allowNone: true }),
  },
  render: (v) => <PopoverPlaygroundFixture {...v} />,
});
