import { useState } from 'react';
import {
  boolean,
  defineState,
  definePlayground,
  List,
  Matrix,
  select,
  Slot,
  text,
  Wrap,
} from '../../gallery';
import { TONE_NAMES, type Tone } from '../../style';
import { RadioGroup, type RadioGroupVariant } from './radio-group';
import type { ControlSize, Option } from '../control';

const VARIANTS = ['plain', 'card'] as const;
const SIZES = ['sm', 'md', 'lg'] as const;

/** Rest, and the two ways a group stops taking edits. */
const INTERACTIONS = ['rest', 'disabled', 'read-only'] as const;
const INTERACTION_PROPS: Record<
  (typeof INTERACTIONS)[number],
  { disabled?: boolean; readOnly?: boolean }
> = {
  rest: {},
  // Out of the tab order and out of the form.
  disabled: { disabled: true },
  // Still focusable, still submitted — it just refuses the change.
  'read-only': { readOnly: true },
};

const FEW: Option[] = [
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'compact', label: 'Compact' },
];

const WITH_DISABLED: Option[] = [
  ...FEW,
  { value: 'dense', label: 'Dense', disabled: true },
];

const MANY: Option[] = [
  'Backlog',
  'Todo',
  'In progress',
  'In review',
  'Blocked',
  'Done',
  'Cancelled',
].map((label) => ({ value: label.toLowerCase().replace(/\s+/g, '-'), label }));

const LONG: Option[] = [
  { value: 'auto', label: 'Match whatever height the surrounding row happens to settle on' },
  { value: 'fixed', label: 'Fixed' },
];

// The four shapes the option list actually arrives in. A group is only as wide
// as its labels, so the ones that overflow say so here rather than in a bug.
const CONTENTS = [
  { name: 'few', options: FEW, wrap: false },
  { name: 'many', options: MANY, wrap: true },
  { name: 'a very long label', options: LONG, wrap: true },
  { name: 'one option disabled', options: WITH_DISABLED, wrap: false },
] as const;

/**
 * A driven group. `name` is deliberately never passed: every specimen on this
 * page proves the generated one keeps the groups apart, and there are sixty of
 * them on the page at once.
 */
function Choice({
  options = FEW,
  ...props
}: {
  options?: Option[];
  label?: string;
  variant?: RadioGroupVariant;
  size?: ControlSize;
  tone?: Tone;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
}) {
  const [value, setValue] = useState(options[0]!.value);
  return (
    <RadioGroup label="Density" {...props} options={options} value={value} onChange={setValue} />
  );
}

export const meta = { title: 'RadioGroup', group: 'Components', size: 'full' };

// Both axes at once: `card` carries padding and a border that `plain` does
// not, so the rungs land on different total heights and only the crossing
// shows whether the mark ladder still lines up with the row text.
const variantSize = defineState({
  title: 'variant × size',
  render: () => (
    <Matrix
      rows={SIZES}
      columns={VARIANTS}
      cell={(size, variant) => <Choice size={size} variant={variant} />}
    />
  ),
});

const content = defineState({
  title: 'content',
  render: () => (
    <List>
      {CONTENTS.map(({ name, options, wrap }) => (
        <Slot key={name} label={name}>
          <Choice options={[...options]} className={wrap ? 'flex-wrap' : undefined} />
        </Slot>
      ))}
    </List>
  ),
});

// Read-only is NOT the disabled look, and this is where that shows: the labels
// keep full contrast because the value still matters, and only the cursor and
// the hover response go.
const interaction = defineState({
  title: 'interaction × variant',
  render: () => (
    <Matrix
      rows={INTERACTIONS}
      columns={VARIANTS}
      cell={(interaction, variant) => (
        <Choice variant={variant} options={WITH_DISABLED} {...INTERACTION_PROPS[interaction]} />
      )}
    />
  ),
});

// `card` rather than `plain`: the tone paints the container border and ground
// as well as the dot, so a wrong ramp is visible at a glance instead of inside
// a 16px circle.
const tones = defineState({
  title: 'tones',
  render: ({ tones: toneSet }) => (
    <Wrap>
      {toneSet.map((tone) => (
        <Slot key={tone} label={tone}>
          <Choice variant="card" tone={tone} />
        </Slot>
      ))}
    </Wrap>
  ),
});

export const states = [variantSize, content, interaction, tones];

export const playground = definePlayground({
  docs: {
    summary:
      'A single choice, every option visible at once. `label` is required — it renders as the `<legend>`, and a `<fieldset>` is the one control a `<label for>` cannot name from outside. `name` is optional and generated: grouping the radios is bookkeeping the component can do for itself.',
  },
  controls: {
    variant: select(VARIANTS, {
      initial: 'plain',
      type: 'RadioGroupVariant',
      description:
        'How much room each option gets. `card` makes the whole option a hit area and lights it when selected — reach for it in a settings pane or under a thumb.',
    }),
    size: select(SIZES, { initial: 'md', type: 'ControlSize', description: 'Row height — 28 / 36 / 44px.' }),
    tone: select([...TONE_NAMES], {
      allowNone: true,
      type: 'Tone',
      description: 'Which ramp the selected dot, the card fill and the focus ring paint from. Defaults to `primary`.',
    }),
    label: text('Density', {
      required: true,
      description: 'The group’s accessible name, rendered as a visually hidden `<legend>`.',
    }),
    disabled: boolean(false, {
      description: 'Whole group: out of the tab order and out of form submission. Single options carry their own `disabled`.',
    }),
    readOnly: boolean(false, {
      description:
        'Not editable, but still focusable and still submitted. HTML’s `readonly` is inert on a radio, so this is `aria-readonly` plus a refusal to emit `onChange`.',
    }),
  },
  render: (v) => <Choice {...v} options={WITH_DISABLED} />,
});
