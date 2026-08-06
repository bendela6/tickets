import { useState } from 'react';
import { defineState, Slot } from '../../../../docs/gallery';
import type { Option } from '../../contract';
import { CheckboxGroup } from './checkbox-group';

export const meta = { title: 'CheckboxGroup', group: 'Inputs', size: 'sm' };

/*
 * Several independent choices, all visible — the multi-select counterpart to
 * RadioGroup, making the same trade against MultiSelect that RadioGroup makes
 * against Select: width, for reading every option without opening anything.
 *
 * The parent is genuinely INDETERMINATE. A half-selected parent painted as
 * "checked but paler" is indistinguishable from a disabled one, and the platform
 * has a real third display state for exactly this.
 */

const FILTERS: Option[] = [
  { value: 'assigned', label: 'Assigned to me' },
  { value: 'watching', label: 'Watching' },
  { value: 'mentioned', label: 'Mentioned me' },
  { value: 'archived', label: 'Archived', disabled: true },
];

function Live({ initial = ['watching'], ...props }: { initial?: string[] } & Record<string, unknown>) {
  const [value, setValue] = useState<string[]>(initial);
  return (
    <CheckboxGroup label="Filters" options={FILTERS} value={value} onChange={setValue} {...props} />
  );
}

export const states = [
  defineState({
    title: 'the parent goes indeterminate, not pale',
    render: () => (
      <Slot label="check one child — the parent shows a bar; check them all — it fills">
        <Live selectAllLabel="All filters" showLabel />
      </Slot>
    ),
  }),

  defineState({
    // A disabled option nobody can reach must not hold the parent permanently
    // indeterminate, and clearing must not silently drop it.
    title: 'a disabled option is outside the parent’s reach',
    render: () => (
      <Slot label="Archived is locked on; All filters ignores it in both directions">
        <Live initial={['assigned', 'watching', 'mentioned', 'archived']} selectAllLabel="All filters" />
      </Slot>
    ),
  }),

  defineState({
    title: 'read-only, and disabled',
    render: () => (
      <div className="flex gap-32">
        <Live readOnly />
        <Live disabled />
      </div>
    ),
  }),
];
