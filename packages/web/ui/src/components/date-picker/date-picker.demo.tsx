import { useState } from 'react';
import { boolean, definePlayground, select } from '../../gallery';
import { TONE_NAMES } from '../../style';
import { DatePicker } from './date-picker';

function DatePickerFixture() {
  const [date, setDate] = useState<string | null>('2026-07-09T00:00:00Z');
  return (
    <div className="w-224">
      <DatePicker value={date} onChange={setDate} />
    </div>
  );
}

function DatePickerPlaygroundFixture({
  size,
  disabled,
}: {
  size: 'sm' | 'md' | 'lg' | undefined;
  disabled: boolean;
}) {
  const [date, setDate] = useState<string | null>('2026-07-09T00:00:00Z');
  return (
    <div className="w-224">
      <DatePicker value={date} onChange={setDate} size={size} disabled={disabled} />
    </div>
  );
}

export const meta = { title: 'DatePicker', group: 'Components', size: 'md' };

export const states = [
  { name: 'basic', render: () => <DatePickerFixture /> },
];

export const playground = definePlayground({
  controls: {
    size: select(['sm', 'md', 'lg'], { allowNone: true }),
    tone: select([...TONE_NAMES], { allowNone: true }),
    disabled: boolean(),
  },
  render: (v) => <DatePickerPlaygroundFixture {...v} />,
});
