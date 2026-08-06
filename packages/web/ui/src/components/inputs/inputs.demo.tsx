import { useState } from 'react';
import { defineState, Matrix, Slot } from '../../gallery';
import type { ControlSize, Option } from './control';
import { Checkbox } from './checkbox';
import { CheckboxGroup } from './checkbox-group';
import { ColorPicker } from './color-picker';
import { Combobox } from './combobox';
import { DatePicker } from './date-picker';
import { DateRangePicker, type DateRange } from './date-range-picker';
import { DurationInput } from './duration-input';
import { FileInput, type UploadFile } from './file-input';
import { IconPicker } from './icon-picker';
import { Input } from './input';
import { MultiCombobox } from './multi-combobox';
import { NumberInput } from './number-input';
import { PasswordInput } from './password-input';
import { PinInput } from './pin-input';
import { RadioGroup } from './radio-group';
import { RangeSlider } from './range-slider';
import { Rating } from './rating';
import { SearchInput } from './search-input';
import { SegmentedControl } from './segmented-control';
import { Select } from './select';
import { Slider } from './slider';
import { Switch } from './switch';
import { TagInput } from './tag-input';
import { Textarea } from './textarea';
import { TimePicker } from './time-picker';
import { UserPicker, type Person } from './user-picker';

export const meta = { title: 'All inputs', group: 'Inputs', size: 'full' };

/*
 * Every control, side by side, against the axes they all share.
 *
 * Each control's own page covers what is particular to it — indeterminate,
 * chips overflowing to +N, a slider's step grid. This page exists for the
 * opposite question: whether twenty-six controls built over many sittings
 * actually agree. A row that dims differently under `disabled`, or keeps its
 * floor under `read-only`, is visible here and nowhere else.
 *
 * It is only possible because they answer to one contract. Without
 * `ControlProps<T>` a page like this would need twenty-six prop shapes and
 * twenty-six onChange signatures to render a single column.
 *
 * Two controls are shown but sit outside parts of the comparison, and both say
 * so where they appear: SearchInput has no `readOnly` (it filters a view rather
 * than holding a value), and FileInput's value is a list of objects rather than
 * a scalar.
 */

const OPTIONS: Option[] = [
  { value: 'a', label: 'Alpha', color: 'indigo' },
  { value: 'b', label: 'Beta', color: 'green' },
  { value: 'c', label: 'Gamma', color: 'orange' },
];

const PLAIN: Option[] = OPTIONS.map(({ value, label }) => ({ value, label }));

const PEOPLE: Person[] = [
  { id: 'da', name: 'Dara Ahmed', detail: '@dara' },
  { id: 'rk', name: 'Rae Kim', detail: '@rae' },
];

const FILES: UploadFile[] = [{ id: '1', name: 'trace.log', size: 1536 }];

/** The twenty-six, in the design's own order: text entry, then single choice,
 *  then multi, boolean, range, date, and the specialised pickers. Reading down
 *  the column should feel like reading down §03–§09 of the spec. */
const CONTROLS = [
  'Input',
  'Textarea',
  'NumberInput',
  'PasswordInput',
  'SearchInput',
  'PinInput',
  'Select',
  'Combobox',
  'RadioGroup',
  'SegmentedControl',
  'MultiCombobox',
  'CheckboxGroup',
  'TagInput',
  'Checkbox',
  'Switch',
  'Slider',
  'RangeSlider',
  'Rating',
  'DatePicker',
  'DateRangePicker',
  'TimePicker',
  'DurationInput',
  'ColorPicker',
  'IconPicker',
  'UserPicker',
  'FileInput',
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
  const [secret, setSecret] = useState('sk_live_4f2a');
  const [query, setQuery] = useState('retry');
  const [code, setCode] = useState('429');
  const [tags, setTags] = useState<string[]>(['flaky']);
  const [span, setSpan] = useState<[number, number]>([2, 5]);
  const [stars, setStars] = useState(3);
  const [range, setRange] = useState<DateRange>(['2026-08-04T00:00:00Z', '2026-08-18T00:00:00Z']);
  const [time, setTime] = useState<string | null>('14:30');
  const [mins, setMins] = useState<number | null>(150);
  const [hue, setHue] = useState<string | null>('blue');
  const [icon, setIcon] = useState<string | null>('search');
  const [who, setWho] = useState<string[]>(['da']);
  const [files, setFiles] = useState<UploadFile[]>(FILES);

  switch (name) {
    case 'Input':
      return <Input aria-label="Name" value={text} onChange={setText} {...flags} />;
    case 'Textarea':
      return <Textarea aria-label="Notes" rows={2} value={text} onChange={setText} {...flags} />;
    case 'NumberInput':
      return <NumberInput value={num} onChange={setNum} {...flags} />;
    case 'PasswordInput':
      return <PasswordInput aria-label="Key" value={secret} onChange={setSecret} {...flags} />;
    case 'SearchInput':
      // No `readOnly`: it filters a view rather than holding a value, which is
      // also why it is the one control with no form kind.
      return (
        <SearchInput
          aria-label="Search"
          value={query}
          onChange={setQuery}
          shortcut="⌘K"
          {...{ ...flags, readOnly: undefined }}
        />
      );
    case 'PinInput':
      return <PinInput value={code} onChange={setCode} length={4} {...flags} />;
    case 'Select':
      return <Select options={OPTIONS} value={one} onChange={setOne} {...flags} />;
    case 'Combobox':
      return <Combobox options={OPTIONS} value={one} onChange={setOne} {...flags} />;
    case 'RadioGroup':
      return <RadioGroup label="Kind" options={PLAIN} value={pick} onChange={setPick} {...flags} />;
    case 'SegmentedControl':
      return (
        <SegmentedControl label="View" options={PLAIN} value={pick} onChange={setPick} {...flags} />
      );
    case 'MultiCombobox':
      return <MultiCombobox options={OPTIONS} value={many} onChange={setMany} {...flags} />;
    case 'CheckboxGroup':
      return <CheckboxGroup label="Filters" options={PLAIN} value={many} onChange={setMany} {...flags} />;
    case 'TagInput':
      return <TagInput value={tags} onChange={setTags} {...flags} />;
    case 'Checkbox':
      return <Checkbox label="Notify" value={on} onChange={setOn} {...flags} />;
    case 'Switch':
      return <Switch label="Notify" value={on} onChange={setOn} {...flags} />;
    case 'Slider':
      return <Slider label="Weight" value={amount} onChange={setAmount} {...flags} />;
    case 'RangeSlider':
      return <RangeSlider label="Points" value={span} onChange={setSpan} min={0} max={10} {...flags} />;
    case 'Rating':
      return <Rating label="Severity" value={stars} onChange={setStars} {...flags} />;
    case 'DatePicker':
      return <DatePicker value={day} onChange={setDay} {...flags} />;
    case 'DateRangePicker':
      return <DateRangePicker value={range} onChange={setRange} {...flags} />;
    case 'TimePicker':
      return <TimePicker value={time} onChange={setTime} {...flags} />;
    case 'DurationInput':
      return <DurationInput value={mins} onChange={setMins} {...flags} />;
    case 'ColorPicker':
      return <ColorPicker value={hue} onChange={setHue} {...flags} />;
    case 'IconPicker':
      return <IconPicker value={icon} onChange={setIcon} {...flags} />;
    case 'UserPicker':
      return <UserPicker people={PEOPLE} value={who} onChange={setWho} {...flags} />;
    case 'FileInput':
      return <FileInput value={files} onChange={setFiles} {...flags} />;
  }
}

export const states = [
  defineState({
    title: 'every control × availability',
    // The comparison this page exists for. `disabled` should read the same way
    // in all twenty-six rows — one opacity, chrome and value fading together —
    // and `read-only` should read differently from it in all of them: a printed
    // row, because a value you may not edit is not a value that does not apply.
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
    // One ladder, 30 / 38 / 46px. Rows that do not step together are the defect,
    // and at this length a single control that kept its own private map is
    // obvious in a way it never is on its own page.
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
    // controls that draw a floor take it as a fill plus a rung-6 rim; the marks
    // paint from it instead.
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
