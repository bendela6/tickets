import { useState } from 'react';
import { defineState, Slot } from '../../../gallery';
import { PinInput } from './pin-input';

export const meta = { title: 'PinInput', group: 'Inputs', size: 'sm' };

/*
 * The cells are one VALUE, not six. Six independent fields would leave the
 * caller reassembling them, and would make pasting — which is how most codes are
 * actually entered — somebody else's problem.
 */

function Live({ initial = '', ...props }: { initial?: string } & Record<string, unknown>) {
  const [value, setValue] = useState(initial);
  return <PinInput value={value} onChange={setValue} {...props} />;
}

export const states = [
  defineState({
    title: 'typing advances; pasting fills every cell',
    render: () => (
      <Slot label="paste a six-character code into the first cell — it spreads rather than truncating">
        <Live />
      </Slot>
    ),
  }),

  defineState({
    title: 'backspace walks the code',
    render: () => (
      <Slot label="hold backspace — an empty cell steps back and clears the one before">
        <Live initial="429" />
      </Slot>
    ),
  }),

  defineState({
    // There is no `invalid` prop anywhere in this library: a rejected code is
    // tone="danger" and nothing else.
    title: 'a rejected code is a tone, not a prop',
    render: () => (
      <div className="flex flex-col gap-8">
        <Live initial="429117" tone="danger" />
        <p className="font-sans text-11 text-red-11">That code has expired.</p>
      </div>
    ),
  }),

  defineState({
    title: 'a shorter code, and the locked states',
    render: () => (
      <div className="flex flex-col gap-12">
        <Live initial="1234" length={4} />
        <Live initial="429117" readOnly />
        <Live initial="429117" disabled />
      </div>
    ),
  }),
];
