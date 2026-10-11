import { Button, Popover, PopoverContent, PopoverTrigger } from '@bh/ui';

export function SideAndAlign() {
  return (
    <div className="flex gap-8">
      <Popover>
        <PopoverTrigger asChild>
          <Button>Below</Button>
        </PopoverTrigger>
        <PopoverContent className="p-12">Below, at the start.</PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger asChild>
          <Button>Above</Button>
        </PopoverTrigger>
        <PopoverContent side="top" align="center" className="p-12">
          Above, centred.
        </PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger asChild>
          <Button>Right</Button>
        </PopoverTrigger>
        <PopoverContent side="right" className="p-12">
          To the right.
        </PopoverContent>
      </Popover>
    </div>
  );
}
