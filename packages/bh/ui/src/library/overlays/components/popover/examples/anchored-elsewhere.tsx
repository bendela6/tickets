import { Button, Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@bh/ui';

export function AnchoredElsewhere() {
  return (
    <Popover>
      <PopoverAnchor asChild>
        <div className="rounded-8 border-gray-6 flex w-320 items-center gap-8 border-1 py-4 pr-4 pl-12">
          <span className="text-13 flex-1">holiday.jpg</span>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm">
              Details
            </Button>
          </PopoverTrigger>
        </div>
      </PopoverAnchor>
      <PopoverContent className="w-320 p-12">2.4 MB, 1920 by 1080 pixels.</PopoverContent>
    </Popover>
  );
}
