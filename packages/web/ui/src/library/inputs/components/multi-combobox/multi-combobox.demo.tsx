import { useState } from 'react';
import {
  boolean,
  definePlayground,
  defineState,
  number,
  select,
  Slot,
  text,
  Wrap,
} from '../../../../docs/gallery';
import { TONE_NAMES, type Tone } from '../../../../style';
import { MultiCombobox } from './multi-combobox';
import type { ControlSize, Option } from '../../contract';

const LABEL_OPTIONS: Option[] = [
  { value: 'frontend', label: 'frontend', color: 'blue' },
  { value: 'api', label: 'api', color: 'green' },
  { value: 'infra', label: 'infra', color: 'gray' },
  { value: 'docs', label: 'docs', color: 'purple' },
  { value: 'design', label: 'design', color: 'pink' },
  // The one label nobody sizes a column for. Kept in the same set as the short
  // ones so the wrap it forces is visible next to the rows that do not wrap.
  { value: 'migration', label: 'database migration · phase two rollout', color: 'orange' },
];

const SHORT = ['frontend', 'api', 'infra', 'docs', 'design'];

/**
 * One live field. Every section drives this rather than `<MultiCombobox>`
 * directly: the control is only honest with state behind it — an uncontrolled
 * specimen shows a list that never changes what the trigger says.
 */
function Labels({
  initial = [],
  options = LABEL_OPTIONS,
  placeholder = 'Labels',
  size,
  tone,
  disabled,
  readOnly,
  maxChips,
}: {
  initial?: string[];
  options?: Option[];
  placeholder?: string;
  size?: ControlSize;
  tone?: Tone;
  disabled?: boolean;
  readOnly?: boolean;
  maxChips?: number;
}) {
  const [value, setValue] = useState<string[]>(initial);
  return (
    <div className="w-288">
      <MultiCombobox
        options={options}
        value={value}
        onChange={setValue}
        placeholder={placeholder}
        size={size}
        tone={tone}
        disabled={disabled}
        readOnly={readOnly}
        maxChips={maxChips}
      />
    </div>
  );
}

// What the trigger has to survive. Written as data rather than as six hand-laid
// specimens so a seventh case is a line, and so the axis is legible as a list of
// the things that break a chip row: nothing, one, a full row, an overflowing
// row, a label wider than the field, and an option set with nothing in it.
const CONTENT: { label: string; initial: string[]; options?: Option[] }[] = [
  { label: 'empty', initial: [] },
  { label: 'one chip', initial: ['frontend'] },
  { label: 'at maxChips (3)', initial: SHORT.slice(0, 3) },
  { label: 'over maxChips → +N', initial: SHORT },
  { label: 'long label', initial: ['migration'] },
  // Not the same state as `empty`: that one has a list to open, this one opens
  // on "No matches" and can never be filled.
  { label: 'no options', initial: [], options: [] },
];

const content = defineState({
  title: 'content',
  render: () => (
    <Wrap>
      {CONTENT.map(({ label, initial, options }) => (
        <Slot key={label} label={label}>
          <Labels initial={initial} options={options} />
        </Slot>
      ))}
    </Wrap>
  ),
});

// A floor rather than a height: chips wrap onto more rows as they accumulate,
// so each rung is where an empty trigger starts, not where a full one stops.
// Every rung carries the same three chips so the growth is the only difference.
const SIZES = [
  { size: 'xs', floor: 28 },
  { size: 'md', floor: 36 },
  { size: 'lg', floor: 44 },
] as const;

const sizes = defineState({
  title: 'sizes',
  render: () => (
    <Wrap>
      {SIZES.map(({ size, floor }) => (
        <Slot key={size} label={`${size} · ${floor}px floor`}>
          <Labels size={size} initial={SHORT.slice(0, 3)} />
        </Slot>
      ))}
    </Wrap>
  ),
});

// The three ways a field can be reached, and the two that are not the same
// thing. `disabled` is "not for you" — out of the tab order, out of the
// submission, dimmed. `readOnly` is "not editable here" about a value that
// still matters: full contrast, still focusable, still submitted, and the list
// simply refuses to open.
const INTERACTION = [
  { label: 'rest', props: {} },
  { label: 'disabled', props: { disabled: true } },
  { label: 'read-only', props: { readOnly: true } },
] as const;

const interaction = defineState({
  title: 'interaction',
  render: () => (
    <Wrap>
      {INTERACTION.map(({ label, props }) => (
        <Slot key={label} label={label}>
          <Labels initial={SHORT.slice(0, 2)} {...props} />
        </Slot>
      ))}
    </Wrap>
  ),
});

// Unset is not `primary`. It is the resting field — gray border, accent focus
// ring — and only a named tone paints the border, which is why the first slot
// here passes no tone at all and has to look different from the rest.
const TONE_SAMPLE = ['danger', 'warning', 'success'] as const satisfies readonly Tone[];

const tones = defineState({
  title: 'tone',
  render: () => (
    <Wrap>
      <Slot label="unset · resting">
        <Labels initial={['frontend']} />
      </Slot>
      {TONE_SAMPLE.map((tone) => (
        <Slot key={tone} label={tone}>
          <Labels tone={tone} initial={['frontend']} />
        </Slot>
      ))}
      <Slot label="danger · read-only">
        <Labels tone="danger" readOnly initial={['frontend']} />
      </Slot>
    </Wrap>
  ),
});

export const meta = { title: 'MultiCombobox', size: 'lg' };

export const states = [content, sizes, interaction, tones];

export const playground = definePlayground({
  docs: {
    summary:
      'The multi-select field. `value` is always a `string[]` — nothing selected is `[]`, never null — and the chips on the trigger are read-only: deselecting happens in the list, where the whole set is visible.',
  },
  controls: {
    placeholder: text('Labels'),
    size: select(['xs', 'md', 'lg'] as const, { allowNone: true, type: 'ControlSize' }),
    tone: select([...TONE_NAMES], {
      allowNone: true,
      type: 'Tone',
      description: 'Unset is the resting neutral field, not a synonym for `primary`.',
    }),
    disabled: boolean(false, {
      description: 'Not applicable: out of the tab order and out of form submission.',
    }),
    readOnly: boolean(false, {
      description:
        'Not editable, but still focusable and still submitted. The list refuses to open.',
    }),
    maxChips: number(3, {
      min: 1,
      max: 10,
      description: 'Chips shown on the trigger before the rest collapse to +N.',
    }),
  },
  render: (v) => <Labels initial={SHORT.slice(0, 4)} {...v} />,
});
