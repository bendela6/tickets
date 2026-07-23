import { useState } from 'react';
import { DatePicker } from './date-picker';

function DatePickerFixture() {
  const [date, setDate] = useState<string | null>('2026-07-09T00:00:00Z');
  return (
    <div className="w-56">
      <DatePicker value={date} onChange={setDate} />
    </div>
  );
}

export const meta = { title: 'DatePicker', group: 'Pickers' };

export const states = [
  { name: 'basic', render: () => <DatePickerFixture /> },
];
