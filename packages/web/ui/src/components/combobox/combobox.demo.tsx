import { useState } from 'react';
import { boolean, definePlayground, select, text } from '../../gallery';
import { Combobox } from './combobox';
import type { ComboOption } from '../combobox-list';

const PRIORITY_OPTIONS: ComboOption[] = [
  { value: 'p0', label: 'P0 · critical', color: 'red' },
  { value: 'p1', label: 'P1 · high', color: 'orange' },
  { value: 'p2', label: 'P2 · normal', color: 'gray' },
  { value: 'p3', label: 'P3 · low', color: 'blue' },
];

function ComboboxFixture() {
  const [priority, setPriority] = useState<string | null>('p0');
  return (
    <div className="w-56">
      <Combobox
        options={PRIORITY_OPTIONS}
        value={priority}
        onChange={setPriority}
        placeholder="Priority"
        clearable
      />
    </div>
  );
}

function ComboboxPlaygroundFixture({
  placeholder,
  clearable,
  disabled,
  size,
}: {
  placeholder: string;
  clearable: boolean;
  disabled: boolean;
  size: 'compact' | 'regular' | undefined;
}) {
  const [priority, setPriority] = useState<string | null>('p0');
  return (
    <div className="w-56">
      <Combobox
        options={PRIORITY_OPTIONS}
        value={priority}
        onChange={setPriority}
        placeholder={placeholder}
        clearable={clearable}
        disabled={disabled}
        size={size}
      />
    </div>
  );
}

export const meta = { title: 'Combobox', group: 'Pickers', size: 'md' };

export const states = [
  { name: 'basic', render: () => <ComboboxFixture /> },
];

export const playground = definePlayground({
  controls: {
    placeholder: text('Priority'),
    clearable: boolean(true),
    disabled: boolean(),
    size: select(['compact', 'regular'], { allowNone: true }),
  },
  render: (v) => <ComboboxPlaygroundFixture {...v} />,
});
