import { useState } from 'react';
import { defineState, Slot } from '../../../../gallery';
import { DurationInput } from './duration-input';

export const meta = { title: 'DurationInput', group: 'Inputs', size: 'sm' };

/*
 * A LENGTH of time, not a clock time. 14:30 is half past two; 2h30 is two and a
 * half hours — and an estimate field that accepted the first would store the
 * wrong number until a report came out wrong.
 *
 * 2h30, 2h 30m, 2.5h and 150m all reach the same value. Because the parser is
 * that forgiving it shows its working while you type, or a silently-accepted
 * 2.5h looks like a parser that ignored you.
 */

function Live({ initial = 150, ...props }: { initial?: number | null } & Record<string, unknown>) {
  const [value, setValue] = useState<number | null>(initial);
  return (
    <div className="w-224">
      <DurationInput value={value} onChange={setValue} {...props} />
    </div>
  );
}

export const states = [
  defineState({
    title: 'four spellings, one duration',
    render: () => (
      <Slot label="try 2h30, 2.5h, 150m and 45 — the echo under the field says what each becomes">
        <Live initial={null} />
      </Slot>
    ),
  }),

  defineState({
    title: 'unreadable text is kept for correction, not eaten',
    render: () => (
      <Slot label="type “zzz” and tab away — the typo stays so it can be fixed">
        <Live initial={null} />
      </Slot>
    ),
  }),

  defineState({
    // Going over is a fact about the work, not a mistake in the field — so it is
    // stated, and the field keeps its tone rather than turning red.
    title: 'over the estimate is a fact, not an error',
    render: () => <Live initial={555} budgetMinutes={210} />,
  }),

  defineState({
    title: 'a stored zero, and the locked states',
    render: () => (
      <div className="flex flex-col gap-12">
        <Live initial={0} />
        <Live readOnly />
        <Live disabled />
      </div>
    ),
  }),
];
