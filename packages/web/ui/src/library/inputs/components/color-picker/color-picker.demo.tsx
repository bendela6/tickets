import { useState } from 'react';
import { defineState, Matrix, Slot } from '../../../../docs/gallery';
import { Chip } from '../../parts/chip';
import type { ControlSize } from '../../contract';
import { ColorPicker } from './color-picker';

export const meta = { title: 'ColorPicker', group: 'Inputs', size: 'md' };

/*
 * Eleven ramps and nothing else — no spectrum, no eyedropper. Every colour here
 * LABELS something, and a free colour is a colour with no rung: no readable text
 * pair, no fill. Bounding the choice is what lets a picked hue drive a chip
 * without anyone checking contrast by hand.
 *
 * Selection is an inset dot. A border would sit on the swatch's own edge and mix
 * with it, so the colour you are judging would stop being the colour you get.
 */

const SIZES: ControlSize[] = ['xs', 'md', 'lg'];

function Live({ initial = 'blue', ...props }: { initial?: string | null } & Record<string, unknown>) {
  const [value, setValue] = useState<string | null>(initial);
  return <ColorPicker value={value} onChange={setValue} className="w-224" {...props} />;
}

export const states = [
  defineState({
    title: 'swatch and name, always both',
    render: () => (
      <Slot label="open it — the ring is the cursor, the dot is the selection">
        <Live />
      </Slot>
    ),
  }),

  defineState({
    title: 'and what the picked hue then drives',
    // The point of bounding the palette: a hue picked here has a rung-2 fill and
    // rung-11 text waiting for it, so a label built from it is legible by
    // construction rather than by inspection.
    render: () => {
      const InUse = () => {
        const [hue, setHue] = useState<string | null>('purple');
        return (
          <div className="flex flex-col gap-12">
            <ColorPicker value={hue} onChange={setHue} className="w-224" />
            <div className="flex items-center gap-8">
              <Chip label="frontend" tone={(hue ?? 'primary') as never} />
              <Chip label="P0" tone={(hue ?? 'primary') as never} />
            </div>
          </div>
        );
      };
      return <InUse />;
    },
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
