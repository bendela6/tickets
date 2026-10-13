import { useId, useState } from 'react';
import { Combobox, FieldLabel, type Option, type OptionGroup } from '@bh/ui';

const FRUITS: Option[] = [
  { value: 'lemon', label: 'Lemon' },
  { value: 'lime', label: 'Lime' },
  {
    value: 'blackberry',
    label: 'Blackberry',
    disabled: true,
    disabledReason: 'Out of season until June.',
  },
  { value: 'blueberry', label: 'Blueberry' },
  { value: 'raspberry', label: 'Raspberry' },
  { value: 'peach', label: 'Peach' },
  {
    value: 'plum',
    label: 'Plum',
    disabled: true,
    disabledReason: 'Sold out. More comes in on Friday.',
  },
];

const KIND: Record<string, string> = {
  lemon: 'citrus',
  lime: 'citrus',
  blackberry: 'berries',
  blueberry: 'berries',
  raspberry: 'berries',
  peach: 'stone',
  plum: 'stone',
};

const KINDS: OptionGroup[] = [
  { key: 'citrus', label: 'Citrus' },
  { key: 'berries', label: 'Berries' },
  { key: 'stone', label: 'Stone fruit' },
];

export function GroupedWithoutSearch() {
  const id = useId();
  const [fruit, setFruit] = useState<string | null>('lemon');
  return (
    <div className="flex w-256 flex-col gap-6">
      <FieldLabel htmlFor={id}>Fruit</FieldLabel>
      <Combobox
        id={id}
        searchable={false}
        options={FRUITS}
        value={fruit}
        onChange={setFruit}
        groupOf={(option) => KIND[option.value] ?? ''}
        groups={KINDS}
      />
    </div>
  );
}
