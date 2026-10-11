import { useState } from 'react';
import { RangeSlider } from '@bh/ui';

export function DisabledAndReadOnly() {
  const [weekdays, setWeekdays] = useState<[number, number]>([9, 17]);
  const [weekends, setWeekends] = useState<[number, number]>([10, 14]);
  return (
    <div className="flex w-320 flex-col gap-16">
      <RangeSlider
        label="Weekdays"
        disabled
        min={0}
        max={24}
        value={weekdays}
        onChange={setWeekdays}
      />
      <RangeSlider
        label="Weekends"
        readOnly
        min={0}
        max={24}
        value={weekends}
        onChange={setWeekends}
      />
    </div>
  );
}
