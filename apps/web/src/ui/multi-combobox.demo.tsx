import { useState } from 'react';
import { MultiCombobox } from './multi-combobox';
import type { ComboOption } from './combobox-list';

const LABEL_OPTIONS: ComboOption[] = [
  { value: 'frontend', label: 'frontend', color: 'blue' },
  { value: 'api', label: 'api', color: 'green' },
  { value: 'infra', label: 'infra', color: 'gray' },
  { value: 'docs', label: 'docs', color: 'purple' },
  { value: 'design', label: 'design', color: 'pink' },
];

function MultiComboboxFixture() {
  const [labels, setLabels] = useState<string[]>(['frontend', 'api']);
  return (
    <div className="w-72">
      <MultiCombobox
        options={LABEL_OPTIONS}
        value={labels}
        onChange={setLabels}
        placeholder="Labels"
      />
    </div>
  );
}

export const meta = { title: 'MultiCombobox', group: 'Pickers' };

export const states = [
  { name: 'basic', render: () => <MultiComboboxFixture /> },
];
