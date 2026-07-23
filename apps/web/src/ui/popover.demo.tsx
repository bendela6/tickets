import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Button } from './button';

export const meta = { title: 'Popover', group: 'Pickers' };

export const states = [
  {
    name: 'basic',
    render: () => (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="secondary">Open popover</Button>
        </PopoverTrigger>
        <PopoverContent>
          <p className="font-sans text-ui text-ink">Anchored content.</p>
        </PopoverContent>
      </Popover>
    ),
  },
];
