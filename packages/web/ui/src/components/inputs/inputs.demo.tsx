import { useState } from 'react';
import { defineState, Matrix, Slot } from '../../gallery';
import type { ControlSize, Option } from './control';
import { Checkbox } from './checkbox';
import { Combobox } from './combobox';
import { DatePicker } from './date-picker';
import { Input } from './input';
import { MultiCombobox } from './multi-combobox';
import { NumberInput } from './number-input';
import { RadioGroup } from './radio-group';
import { Slider } from './slider';
import { Switch } from './switch';
import { Textarea } from './textarea';

export const meta = { title: 'All inputs', group: 'Inputs', size: 'full' };

/*
 * Every control, side by side, against the axes they all share.
 *
 * Each control's own page covers what is particular to it — indeterminate,
 * chips overflowing to +N, a slider's step grid. This page exists for the
 * opposite question: whether ten controls built by ten different hands actually
 * agree. A row that dims differently under `disabled`, or keeps its border
 * colour under `danger`, is visible here and nowhere else.
 *
 * It is only possible because they answer to one contract. Before that, a page
 * like this would have needed ten different prop shapes and ten different
 * onChange signatures to render a single column.
 */

const OPTIONS: Option[] = [
  { value: 'a', label: 'Alpha', color: 'indigo' },
  { value: 'b', label: 'Beta', color: 'green' },
  { value: 'c', label: 'Gamma', color: 'orange' },
];

const PLAIN: Option[] = OPTIONS.map(({ value, label }) => ({ value, label }));

/** The controls, each reduced to the one thing this page compares: how it
 *  renders under a shared set of flags. State is per-cell so a specimen you
 *  poke stays poked. */
const CONTROLS = [
  'Input',
  'Textarea',
  'NumberInput',
  'Combobox',
  'MultiCombobox',
  'DatePicker',
  'Checkbox',
  'Switch',
  'RadioGroup',
  'Slider',
] as const;
type ControlName = (typeof CONTROLS)[number];

const AVAILABILITY = ['rest', 'disabled', 'read-only'] as const;
type Availability = (typeof AVAILABILITY)[number];

const SIZES: ControlSize[] = ['xs', 'md', 'lg'];

type Flags = { disabled?: boolean; readOnly?: boolean; size?: ControlSize; tone?: 'danger' };

function flagsFor(state: Availability): Flags {
  return state === 'disabled' ? { disabled: true } : state === 'read-only' ? { readOnly: true } : {};
}

/** One live specimen. Every control is driven the same way — `value` in,
 *  `onChange` out — which is the whole point being demonstrated. */
function Specimen({ name, ...flags }: { name: ControlName } & Flags) {
  const [text, setText] = useState('Ada Lovelace');
  const [num, setNum] = useState<number | null>(42);
  const [one, setOne] = useState<string | null>('a');
  const [many, setMany] = useState<string[]>(['a', 'b']);
  const [day, setDay] = useState<string | null>('2026-08-05T00:00:00Z');
  const [on, setOn] = useState(true);
  const [pick, setPick] = useState('a');
  const [amount, setAmount] = useState(60);

  switch (name) {
    case 'Input':
      return <Input aria-label="Name" value={text} onChange={setText} {...flags} />;
    case 'Textarea':
      return <Textarea aria-label="Notes" rows={2} value={text} onChange={setText} {...flags} />;
    case 'NumberInput':
      return <NumberInput value={num} onChange={setNum} {...flags} />;
    case 'Combobox':
      return <Combobox options={OPTIONS} value={one} onChange={setOne} {...flags} />;
    case 'MultiCombobox':
      return <MultiCombobox options={OPTIONS} value={many} onChange={setMany} {...flags} />;
    case 'DatePicker':
      return <DatePicker value={day} onChange={setDay} {...flags} />;
    case 'Checkbox':
      return <Checkbox label="Notify" value={on} onChange={setOn} {...flags} />;
    case 'Switch':
      return <Switch label="Notify" value={on} onChange={setOn} {...flags} />;
    case 'RadioGroup':
      return <RadioGroup label="Kind" options={PLAIN} value={pick} onChange={setPick} {...flags} />;
    case 'Slider':
      return <Slider label="Weight" value={amount} onChange={setAmount} {...flags} />;
  }
}

export const states = [
  defineState({
    title: 'every control × availability',
    // The comparison this page exists for. `disabled` should read the same way
    // in all ten rows, and `read-only` should read differently from it in all
    // ten — a value you may not edit is not a value that does not apply.
    render: () => (
      <Matrix
        rows={CONTROLS}
        columns={AVAILABILITY}
        cell={(control, state) => <Specimen name={control} {...flagsFor(state)} />}
      />
    ),
  }),

  defineState({
    title: 'every control × size',
    // One ladder, 28 / 36 / 44px, after three separate size domains were
    // collapsed into it. Rows that do not step together are the defect.
    render: () => (
      <Matrix
        rows={CONTROLS}
        columns={SIZES}
        cell={(control, size) => <Specimen name={control} size={size} />}
      />
    ),
  }),

  defineState({
    title: 'error, and what carries it',
    // There is no `invalid` prop anywhere: error is a tone like any other,
    // resolved a layer up as `tone={error ? 'danger' : config.tone}`. The
    // controls that draw a border take it; the marks paint from it instead.
    render: () => (
      <Matrix
        rows={CONTROLS}
        columns={['resting', 'danger'] as const}
        cell={(control, column) => (
          <Specimen name={control} {...(column === 'danger' ? { tone: 'danger' } : {})} />
        )}
      />
    ),
  }),

  defineState({
    title: 'read-only is not disabled',
    // Side by side because the distinction is the easiest thing to get wrong,
    // and it is invisible until you compare: read-only keeps full text
    // contrast because the value still matters, and keeps its tab stop and its
    // place in a submission. Disabled gives up all three.
    render: () => (
      <Slot label="tab through both — only the read-only column takes focus">
        <Matrix
          rows={CONTROLS}
          columns={['read-only', 'disabled'] as const}
          cell={(control, column) => <Specimen name={control} {...flagsFor(column)} />}
        />
      </Slot>
    ),
  }),
];
