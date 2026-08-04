import { useState } from 'react';
import { boolean, definePlayground, select, text } from '../../gallery';
import { TONE_NAMES } from '../../style';
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
    <div className="w-224">
      <Combobox
        options={PRIORITY_OPTIONS}
        value={priority}
        onChange={setPriority}
        placeholder="Priority"
      />
    </div>
  );
}

function ComboboxPlaygroundFixture({
  placeholder,
  disabled,
  size,
}: {
  placeholder: string;
  disabled: boolean;
  size: 'sm' | 'md' | 'lg' | undefined;
}) {
  const [priority, setPriority] = useState<string | null>('p0');
  return (
    <div className="w-224">
      <Combobox
        options={PRIORITY_OPTIONS}
        value={priority}
        onChange={setPriority}
        placeholder={placeholder}
        disabled={disabled}
        size={size}
      />
    </div>
  );
}

export const meta = { title: 'Combobox', group: 'Components', size: 'md' };

export const states = [
  { name: 'basic', render: () => <ComboboxFixture /> },
];

export const playground = definePlayground({
  controls: {
    placeholder: text('Priority'),
    disabled: boolean(),
    size: select(['sm', 'md', 'lg'], { allowNone: true }),
    tone: select([...TONE_NAMES], { allowNone: true }),
  },
  render: (v) => <ComboboxPlaygroundFixture {...v} />,
});
