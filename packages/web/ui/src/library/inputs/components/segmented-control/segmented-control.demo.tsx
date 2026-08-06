import { useState } from 'react';
import { defineState, Matrix, Slot } from '../../../../gallery';
import type { ControlSize, Option } from '../../contract';
import { SegmentedControl } from './segmented-control';

export const meta = { title: 'SegmentedControl', group: 'Inputs', size: 'sm' };

/*
 * The same exclusive choice a Select makes, spent differently: width, in
 * exchange for reading every option without opening anything.
 *
 * The indicator is ONE tile that glides. That is the affordance — it says these
 * are positions on a single control, where a tile blinking from place to place
 * reads as separate buttons that happen to sit together.
 */

const VIEWS: Option[] = [
  { value: 'list', label: 'List' },
  { value: 'board', label: 'Board' },
  { value: 'calendar', label: 'Calendar' },
];

const PAIR: Option[] = [
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
];

const SIZES: ControlSize[] = ['xs', 'md', 'lg'];

function Live({ options = VIEWS, ...props }: { options?: Option[] } & Record<string, unknown>) {
  const [value, setValue] = useState(options[0]!.value);
  return <SegmentedControl label="View" options={options} value={value} onChange={setValue} {...props} />;
}

export const states = [
  defineState({
    title: 'the tile glides between positions',
    render: () => (
      <Slot label="click across the segments — one tile moves, it does not blink">
        <div className="flex flex-col items-start gap-12">
          <Live />
          <Live options={PAIR} />
        </div>
      </Slot>
    ),
  }),

  defineState({
    title: 'every rung',
    render: () => (
      <Matrix
        rows={['three', 'two'] as const}
        columns={SIZES}
        cell={(row, size) => <Live options={row === 'two' ? PAIR : VIEWS} size={size} />}
      />
    ),
  }),

  defineState({
    // A single disabled segment refuses without taking the group with it — a
    // different fact from the whole control being unavailable.
    title: 'one segment disabled, versus the whole control',
    render: () => (
      <div className="flex flex-col items-start gap-12">
        <Live options={[...VIEWS, { value: 'gantt', label: 'Gantt', disabled: true }]} />
        <Live disabled />
        <Live readOnly />
      </div>
    ),
  }),
];
