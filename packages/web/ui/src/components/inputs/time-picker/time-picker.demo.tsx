import { useState } from 'react';
import { defineState, Matrix, Slot } from '../../../gallery';
import type { ControlSize } from '../control';
import { TimePicker } from './time-picker';

export const meta = { title: 'TimePicker', group: 'Inputs', size: 'md' };

/*
 * A time of DAY, where DurationInput is a length of time. Held as `HH:MM`
 * because that is what an API stores and what a person reads.
 *
 * Typing sits beside the list rather than behind it: a 15-minute list is 96
 * rows, and the one time you want is reliably the one that is not on it.
 */

const SIZES: ControlSize[] = ['xs', 'md', 'lg'];

function Live({ initial = '14:30', ...props }: { initial?: string | null } & Record<string, unknown>) {
  const [value, setValue] = useState<string | null>(initial);
  return (
    <div className="w-192">
      <TimePicker value={value} onChange={setValue} {...props} />
    </div>
  );
}

export const states = [
  defineState({
    title: 'the list opens scrolled to the value',
    render: () => (
      <Slot label="open it — 14:30 is centred rather than leaving you to find it from midnight">
        <Live />
      </Slot>
    ),
  }),

  defineState({
    title: 'typing beats the list when the list has not got it',
    render: () => (
      <Slot label="type 14:37 and press Enter; then try 25:99">
        <Live initial={null} />
      </Slot>
    ),
  }),

  defineState({
    title: 'a finer schedule',
    render: () => <Live initial="09:05" stepMinutes={5} />,
  }),

  defineState({
    title: 'every rung, empty and filled',
    render: () => (
      <Matrix
        rows={['set', 'empty'] as const}
        columns={SIZES}
        cell={(row, size) => <Live size={size} {...(row === 'empty' ? { initial: null } : {})} />}
      />
    ),
  }),
];
