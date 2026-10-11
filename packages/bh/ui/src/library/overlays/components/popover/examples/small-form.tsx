import { useState } from 'react';
import { Button, Input, Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@bh/ui';

export function SmallForm() {
  const [city, setCity] = useState('Lisbon');
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button chevron>City: {city}</Button>
      </PopoverTrigger>
      <PopoverContent className="flex w-256 flex-col gap-8 p-12">
        <label htmlFor="popover-city" className="text-12 text-gray-11">
          City
        </label>
        <Input id="popover-city" value={city} onChange={setCity} />
        <div className="flex justify-end">
          <PopoverClose asChild>
            <Button variant="solid" size="sm">
              Done
            </Button>
          </PopoverClose>
        </div>
      </PopoverContent>
    </Popover>
  );
}
