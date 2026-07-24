import { useState } from 'react';
import { boolean, definePlayground, select } from '@tickets/ui/gallery';
import { DatePicker } from './date-picker';

function DatePickerFixture() {
  const [date, setDate] = useState<string | null>('2026-07-09T00:00:00Z');
  return (
    <div className="w-56">
      <DatePicker value={date} onChange={setDate} />
    </div>
  );
}

function DatePickerPlaygroundFixture({
  size,
  disabled,
}: {
  size: 'compact' | 'regular' | undefined;
  disabled: boolean;
}) {
  const [date, setDate] = useState<string | null>('2026-07-09T00:00:00Z');
  return (
    <div className="w-56">
      <DatePicker value={date} onChange={setDate} size={size} disabled={disabled} />
    </div>
  );
}

export const meta = { title: 'DatePicker', group: 'Pickers', size: 'md' };

export const states = [
  { name: 'basic', render: () => <DatePickerFixture /> },
];

export const playground = definePlayground({
  controls: {
    size: select(['compact', 'regular'], { allowNone: true }),
    disabled: boolean(),
  },
  render: (v) => <DatePickerPlaygroundFixture {...v} />,
});
