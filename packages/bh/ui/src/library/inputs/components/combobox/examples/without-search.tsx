import { useId, useState } from 'react';
import { Combobox, FieldLabel, type Option } from '@bh/ui';

const REPEATS: Option[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

export function WithoutSearch() {
  const id = useId();
  const [repeat, setRepeat] = useState<string | null>('weekly');
  return (
    <div className="flex w-256 flex-col gap-6">
      <FieldLabel htmlFor={id}>Repeat</FieldLabel>
      <Combobox id={id} searchable={false} options={REPEATS} value={repeat} onChange={setRepeat} />
    </div>
  );
}
