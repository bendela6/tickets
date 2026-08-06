import { useState } from 'react';
import { defineState, Matrix, Slot } from '../../../../gallery';
import type { ControlSize } from '../../contract';
import { SearchInput } from './search-input';

export const meta = { title: 'SearchInput', group: 'Inputs', size: 'md' };

/*
 * One leading glyph, and a trailing gutter that says three different things.
 *
 * The order is the design decision: loading beats the clear, because a clear
 * button that disappears the moment results land is a target that moves under
 * the pointer. The ⌘K hint comes last and only while empty — by the time you
 * have typed, the hint has already done its job.
 */

const SIZES: ControlSize[] = ['xs', 'md', 'lg'];

function Live({ initial = '', ...props }: { initial?: string } & Record<string, unknown>) {
  const [value, setValue] = useState(initial);
  return <SearchInput value={value} onChange={setValue} aria-label="Search tickets" {...props} />;
}

export const states = [
  defineState({
    title: 'the trailing gutter, in its three states',
    render: () => (
      <Slot label="type to swap the hint for a clear; the spinner outranks both">
        <div className="flex w-256 flex-col gap-12">
          <Live shortcut="⌘K" />
          <Live initial="payment retry" shortcut="⌘K" />
          <Live initial="payment retry" shortcut="⌘K" loading />
        </div>
      </Slot>
    ),
  }),

  defineState({
    title: 'every rung',
    render: () => (
      <Matrix
        rows={['empty', 'with a value'] as const}
        columns={SIZES}
        cell={(row, size) => (
          <Live size={size} shortcut="⌘K" {...(row === 'with a value' ? { initial: 'retry' } : {})} />
        )}
      />
    ),
  }),

  defineState({
    title: 'rest, read-only, disabled',
    render: () => (
      <Matrix
        rows={['availability'] as const}
        columns={['rest', 'read-only', 'disabled'] as const}
        cell={(_row, column) => (
          <Live
            initial="payment retry"
            {...(column === 'read-only' ? { readOnly: true } : {})}
            {...(column === 'disabled' ? { disabled: true } : {})}
          />
        )}
      />
    ),
  }),
];
