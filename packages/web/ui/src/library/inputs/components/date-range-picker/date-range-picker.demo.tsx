import { useState } from 'react';
import { defineState, Matrix, Slot } from '../../../../docs/gallery';
import type { ControlSize } from '../../contract';
import { DateRangePicker, type DateRange } from './date-range-picker';

export const meta = { title: 'DateRangePicker', group: 'Inputs', size: 'md' };

/*
 * A span of days. The half-picked state is the one that matters: "4 Aug →" with
 * nothing after it looks broken, so the pending half is a PLACEHOLDER — "4 Aug
 * → end" says the control is waiting for you, which is true.
 *
 * The span paints rung 2 between two square-ended tiles, so the ends and the bar
 * between them read as one shape rather than three.
 */

const SIZES: ControlSize[] = ['xs', 'md', 'lg'];

function Live({ initial = [null, null] as DateRange, ...props }: { initial?: DateRange } & Record<string, unknown>) {
  const [value, setValue] = useState<DateRange>(initial);
  return (
    <div className="w-256">
      <DateRangePicker value={value} onChange={setValue} {...props} />
    </div>
  );
}

export const states = [
  defineState({
    title: 'picking a span, with the preview',
    render: () => (
      <Slot label="click a start, then move across the month — the span paints as you go">
        <Live />
      </Slot>
    ),
  }),

  defineState({
    title: 'half picked — waiting, not broken',
    render: () => <Live initial={['2026-08-04T00:00:00Z', null]} />,
  }),

  defineState({
    // Picking backwards from the anchor is a legitimate gesture, and the value
    // must not come back reversed.
    title: 'settled, and reversible',
    render: () => (
      <Slot label="open it and click a day before the start — the range reorders itself, the value does not">
        <Live initial={['2026-08-04T00:00:00Z', '2026-08-18T00:00:00Z']} />
      </Slot>
    ),
  }),

  defineState({
    title: 'set and empty, at every rung',
    render: () => (
      <Matrix
        rows={['set', 'empty'] as const}
        columns={SIZES}
        cell={(row, size) => (
          <Live
            size={size}
            {...(row === 'set'
              ? { initial: ['2026-08-04T00:00:00Z', '2026-08-18T00:00:00Z'] as DateRange }
              : {})}
          />
        )}
      />
    ),
  }),
];
