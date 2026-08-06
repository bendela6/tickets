import { useState } from 'react';
import { defineState, Matrix, Slot } from '../../../../gallery';
import type { ControlSize, Option } from '../../contract';
import { Select } from './select';

export const meta = { title: 'Select', group: 'Inputs', size: 'md' };

/*
 * The plain single-select — the one the library was missing.
 *
 * Combobox filters as you type and suits a long list; this just opens. The
 * difference that matters visually is the trigger: a Select shows its value as
 * PLAIN TEXT, where every single-select in the product used to render a chip.
 * A chip says "one of several things I am holding", and this holds exactly one.
 */

const TYPES: Option[] = [
  { value: 'task', label: 'Task', color: 'blue' },
  { value: 'bug', label: 'Bug', color: 'red' },
  { value: 'chore', label: 'Chore', color: 'orange' },
  { value: 'epic', label: 'Epic', color: 'purple' },
  { value: 'spike', label: 'Spike', disabled: true },
];

const PLAIN: Option[] = TYPES.map(({ value, label, disabled }) => ({ value, label, disabled }));

const SIZES: ControlSize[] = ['xs', 'md', 'lg'];

function Live({ options = TYPES, ...props }: { options?: Option[] } & Record<string, unknown>) {
  const [value, setValue] = useState<string | null>('task');
  return <Select options={options} value={value} onChange={setValue} {...props} />;
}

export const states = [
  defineState({
    title: 'the value is plain text, never a chip',
    render: () => (
      <Slot label="open it — the dot survives, the chip does not">
        <div className="flex w-256 flex-col gap-12">
          <Live />
          <Live options={PLAIN} />
        </div>
      </Slot>
    ),
  }),

  defineState({
    title: 'empty, and the placeholder that stands in for it',
    render: () => {
      const Empty = () => {
        const [value, setValue] = useState<string | null>(null);
        return (
          <Select
            options={TYPES}
            value={value}
            onChange={setValue}
            placeholder="Choose a type"
            className="w-256"
          />
        );
      };
      return <Empty />;
    },
  }),

  defineState({
    title: 'every rung',
    render: () => (
      <Matrix
        rows={['coloured', 'plain'] as const}
        columns={SIZES}
        cell={(row, size) => (
          <Live options={row === 'plain' ? PLAIN : TYPES} size={size} />
        )}
      />
    ),
  }),

  defineState({
    // The three availability states side by side — read-only drops the chevron
    // because it promises a list that will not open, and keeps its tab stop.
    title: 'rest, disabled, read-only',
    render: () => (
      <Matrix
        rows={['default', 'danger'] as const}
        columns={['rest', 'disabled', 'read-only'] as const}
        cell={(tone, availability) => (
          <Live
            {...(tone === 'danger' ? { tone: 'danger' } : {})}
            {...(availability === 'disabled' ? { disabled: true } : {})}
            {...(availability === 'read-only' ? { readOnly: true } : {})}
          />
        )}
      />
    ),
  }),
];
