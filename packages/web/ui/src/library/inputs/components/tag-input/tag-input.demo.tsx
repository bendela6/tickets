import { useState } from 'react';
import { defineState, Slot } from '../../../../docs/gallery';
import type { ControlSize, Option } from '../../contract';
import { TagInput } from './tag-input';

export const meta = { title: 'TagInput', group: 'Inputs', size: 'md' };

/*
 * Free text in, chips out — for values that do not exist until someone types
 * them, which is what separates this from MultiSelect.
 *
 * A duplicate is REFUSED and the refusal points at the chip that already
 * exists: the message names the tag and the chip nudges once. Silently doing
 * nothing is the same response as a broken Enter key, and adding a second
 * identical chip is worse.
 */

const SUGGESTIONS: Option[] = [
  { value: 'infrastructure', label: 'infrastructure' },
  { value: 'flaky', label: 'flaky' },
  { value: 'design', label: 'design' },
];

const SIZES: ControlSize[] = ['xs', 'md', 'lg'];

function Live({ initial = ['flaky'], ...props }: { initial?: string[] } & Record<string, unknown>) {
  const [value, setValue] = useState<string[]>(initial);
  return (
    <div className="w-320">
      <TagInput value={value} onChange={setValue} suggestions={SUGGESTIONS} {...props} />
    </div>
  );
}

export const states = [
  defineState({
    title: 'creating, and what a duplicate does',
    render: () => (
      <Slot label="type “infra” for the create affordance; type “flaky” and press Enter to be refused">
        <Live />
      </Slot>
    ),
  }),

  defineState({
    title: 'Backspace eats a chip only from an empty draft',
    render: () => (
      <Slot label="type then Backspace — the chip survives; clear the draft first and it goes">
        <Live initial={['api', 'infra']} />
      </Slot>
    ),
  }),

  defineState({
    title: 'every rung',
    render: () => (
      <div className="flex flex-col gap-12">
        {SIZES.map((size) => (
          <Live key={size} size={size} initial={['api', 'infra']} />
        ))}
      </div>
    ),
  }),

  defineState({
    title: 'read-only drops the remove targets; disabled dims the lot',
    render: () => (
      <div className="flex flex-col gap-12">
        <Live initial={['api', 'infra']} readOnly />
        <Live initial={['api', 'infra']} disabled />
      </div>
    ),
  }),
];
