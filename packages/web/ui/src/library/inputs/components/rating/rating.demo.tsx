import { useState } from 'react';
import { defineState, Matrix, Slot } from '../../../../docs/gallery';
import type { ControlSize } from '../../contract';
import { Rating } from './rating';

export const meta = { title: 'Rating', group: 'Inputs', size: 'sm' };

/*
 * The rung pair is the whole design here: a hover PREVIEW is rung 8, a
 * committed value rung 9. Share one rung between them and you cannot tell
 * whether moving the mouse has already changed something — which is the
 * complaint every star rating on the internet earns.
 */

const SIZES: ControlSize[] = ['xs', 'md', 'lg'];

function Live({ initial = 3, ...props }: { initial?: number } & Record<string, unknown>) {
  const [value, setValue] = useState(initial);
  return <Rating label="Severity" value={value} onChange={setValue} {...props} />;
}

export const states = [
  defineState({
    title: 'preview and committed are different rungs',
    render: () => (
      <Slot label="hover across the marks — the preview is the lighter rung; click the one you are on to clear">
        <Live showValue />
      </Slot>
    ),
  }),

  defineState({
    title: 'unrated says so, rather than showing a zero score',
    render: () => <Live initial={0} showValue />,
  }),

  defineState({
    title: 'every rung, and a scale of another length',
    render: () => (
      <Matrix
        rows={['five', 'three'] as const}
        columns={SIZES}
        cell={(row, size) => <Live size={size} {...(row === 'three' ? { max: 3 } : {})} />}
      />
    ),
  }),

  defineState({
    title: 'read-only keeps its tab stop; disabled does not',
    render: () => (
      <Matrix
        rows={['availability'] as const}
        columns={['rest', 'read-only', 'disabled'] as const}
        cell={(_row, column) => (
          <Live
            {...(column === 'read-only' ? { readOnly: true } : {})}
            {...(column === 'disabled' ? { disabled: true } : {})}
          />
        )}
      />
    ),
  }),
];
