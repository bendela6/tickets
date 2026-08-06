import { useState } from 'react';
import { defineState, Slot } from '../../../../docs/gallery';
import { RangeSlider } from './range-slider';

export const meta = { title: 'RangeSlider', size: 'sm' };

/*
 * Two thumbs, and they NEVER swap. Dragging low past high pins it at high
 * rather than trading places: a range that reorders itself under the pointer
 * means the thumb you grabbed is no longer the thumb you are moving, and every
 * pixel after that goes the wrong way.
 *
 * When they collide the held one stays on top — otherwise a range closed to
 * zero traps the other underneath and cannot be reopened.
 */

function Live({ initial = [2, 5] as [number, number], ...props }: { initial?: [number, number] } & Record<string, unknown>) {
  const [value, setValue] = useState<[number, number]>(initial);
  return (
    <div className="w-320">
      <RangeSlider label="Points" value={value} onChange={setValue} min={0} max={10} {...props} />
    </div>
  );
}

export const states = [
  defineState({
    title: 'a span, and the pin at either end',
    render: () => (
      <Slot label="drag the low thumb past the high one — it stops rather than swapping">
        <Live />
      </Slot>
    ),
  }),

  defineState({
    title: 'collided, and still separable',
    render: () => (
      <Slot label="both thumbs are on 3 — click either side of them; the nearer end moves">
        <Live initial={[3, 3]} />
      </Slot>
    ),
  }),

  defineState({
    title: 'a finer range',
    render: () => <Live initial={[20, 60]} min={0} max={100} step={5} />,
  }),

  defineState({
    title: 'read-only keeps both tab stops; disabled gives them up',
    render: () => (
      <div className="flex flex-col gap-16">
        <Live readOnly />
        <Live disabled />
      </div>
    ),
  }),
];
