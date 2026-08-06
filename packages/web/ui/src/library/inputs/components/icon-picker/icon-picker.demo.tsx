import { useState } from 'react';
import { defineState, Matrix, Slot } from '../../../../docs/gallery';
import type { ControlSize } from '../../contract';
import { IconPicker } from './icon-picker';

export const meta = { title: 'IconPicker', size: 'md' };

/*
 * The trigger shows the GLYPH. `circle-dashed` describes a drawing far less well
 * than the drawing does — but the name stays beside it, because that is what you
 * search by and what a screen reader can say.
 *
 * The design's grouped headers are NOT here: our registry is a flat map with no
 * category metadata, so there is nothing behind them. The groups exist in the
 * design to make a 412-icon scroll finite; at this size a max-height does that.
 */

const SIZES: ControlSize[] = ['xs', 'md', 'lg'];

function Live({ initial = 'search', ...props }: { initial?: string | null } & Record<string, unknown>) {
  const [value, setValue] = useState<string | null>(initial);
  return <IconPicker value={value} onChange={setValue} className="w-224" {...props} />;
}

export const states = [
  defineState({
    title: 'glyph in the trigger, search in the popup',
    render: () => (
      <Slot label="type “chevron” to filter, then “zzz” for the empty state">
        <Live />
      </Slot>
    ),
  }),

  defineState({
    title: 'a narrowed set, for a field that only allows a few',
    render: () => <Live initial="folder" icons={['folder', 'file', 'terminal', 'calendar', 'tag']} />,
  }),

  defineState({
    title: 'chosen and empty, at every rung',
    render: () => (
      <Matrix
        rows={['chosen', 'empty'] as const}
        columns={SIZES}
        cell={(row, size) => <Live size={size} {...(row === 'empty' ? { initial: null } : {})} />}
      />
    ),
  }),

  defineState({
    title: 'read-only drops the chevron; disabled dims the field',
    render: () => (
      <div className="flex flex-col gap-12">
        <Live readOnly />
        <Live disabled />
      </div>
    ),
  }),
];
