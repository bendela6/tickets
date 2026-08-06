import { useState } from 'react';
import { defineState, Matrix, Slot } from '../../../../docs/gallery';
import type { ControlSize } from '../../contract';
import { UserPicker, type Person } from './user-picker';

export const meta = { title: 'UserPicker', size: 'md' };

/*
 * The most-used control in the product, so it gets the shortest path: avatar,
 * name, one keystroke.
 *
 * Unassigned is a DASHED RING rather than an empty avatar. An empty avatar reads
 * as a picture that failed to load; a dashed ring reads as a slot nobody is in.
 */

const PEOPLE: Person[] = [
  { id: 'da', name: 'Dara Ahmed', detail: '@dara' },
  { id: 'rk', name: 'Rae Kim', detail: '@rae' },
  { id: 'jm', name: 'Jo Mensah', detail: '@jo' },
  { id: 'sl', name: 'Sam Lee', detail: '@sam' },
  { id: 'tn', name: 'Toni Novak', detail: '@toni' },
];

const SIZES: ControlSize[] = ['xs', 'md', 'lg'];

function Live({ initial = ['da'], ...props }: { initial?: string[] } & Record<string, unknown>) {
  const [value, setValue] = useState<string[]>(initial);
  return <UserPicker people={PEOPLE} value={value} onChange={setValue} className="w-224" {...props} />;
}

export const states = [
  defineState({
    title: 'assigned, and unassigned',
    render: () => (
      <Slot label="the empty slot is a dashed ring — not an avatar with nothing in it">
        <div className="flex flex-col gap-12">
          <Live />
          <Live initial={[]} />
        </div>
      </Slot>
    ),
  }),

  defineState({
    title: 'several, and the overflow',
    // Avatars overlap so a review set costs less width than the same people as
    // chips would; past the cap the tail becomes a count.
    render: () => (
      <div className="flex flex-col gap-12">
        <Live multiple initial={['da', 'rk']} />
        <Live multiple initial={['da', 'rk', 'jm', 'sl', 'tn']} />
      </div>
    ),
  }),

  defineState({
    title: 'search finds the handle as well as the name',
    render: () => (
      <Slot label="type “@rae” — how people actually look for each other">
        <Live initial={[]} />
      </Slot>
    ),
  }),

  defineState({
    title: 'set and empty, at every rung',
    render: () => (
      <Matrix
        rows={['assigned', 'unassigned'] as const}
        columns={SIZES}
        cell={(row, size) => <Live size={size} {...(row === 'unassigned' ? { initial: [] } : {})} />}
      />
    ),
  }),
];
