import { useState, type ComponentProps } from 'react';
import { boolean, definePlayground, number, select } from '../../../gallery';
import { TONE_NAMES } from '../../../style';
import { NumberInput } from './number-input';

const SIZES = ['sm', 'md', 'lg'] as const;

// A sample rather than all of TONE_NAMES: a field's tone only moves its border
// and its focus ring, so four ramps say everything the other thirteen repeat.
// `danger` is the one that has to be here — it is what an invalid field wears.
const TONES = ['primary', 'success', 'warning', 'danger'] as const;

type SpecimenProps = Omit<ComponentProps<typeof NumberInput>, 'value' | 'onChange' | 'ref'> & {
  label: string;
  /** Where the field starts. `null` is a real starting point, not "unset". */
  initial?: number | null;
};

function Specimen({ label, initial = null, ...props }: SpecimenProps) {
  const [value, setValue] = useState<number | null>(initial);
  return (
    <div className="flex items-center gap-8">
      <span className="w-104 shrink-0 text-11/16 text-gray-11">{label}</span>
      <NumberInput value={value} onChange={setValue} {...props} />
    </div>
  );
}

/**
 * What the field can be holding. Every one of these is a distinct state, and
 * the first two are distinct from each other: an estimate nobody has given
 * (`null`) and an estimate of zero are different facts.
 */
const CONTENT = [
  { label: 'empty (null)', initial: null, min: 0, max: 13 },
  { label: 'a value', initial: 5, min: 0, max: 13 },
  { label: 'at min', initial: 0, min: 0, max: 13 },
  { label: 'at max', initial: 13, min: 0, max: 13 },
  { label: 'fractional step', initial: 1.5, min: 0, max: 5, step: 0.5 },
] satisfies SpecimenProps[];

/**
 * Crossed with every content case below. `disabled` and `readOnly` are not two
 * shades of the same thing: disabled dims the value and leaves the tab order,
 * read-only keeps full contrast and keeps its tab stop — only the ground and
 * the stepper affordance change.
 */
const INTERACTIONS = [
  { name: 'content', props: {} },
  { name: 'content · disabled', props: { disabled: true } },
  { name: 'content · read-only', props: { readOnly: true } },
] satisfies { name: string; props: Partial<SpecimenProps> }[];

export const meta = { title: 'NumberInput', group: 'Components', size: 'md' };

export const states = [
  ...INTERACTIONS.map(({ name, props }) => ({
    name,
    render: () => (
      <div className="flex flex-col gap-8">
        {CONTENT.map((content) => (
          <Specimen key={content.label} {...content} {...props} />
        ))}
      </div>
    ),
  })),
  {
    name: 'sizes',
    render: () => (
      <div className="flex flex-col gap-8">
        {SIZES.map((size) => (
          <Specimen key={size} label={size} initial={5} size={size} min={0} max={13} />
        ))}
      </div>
    ),
  },
  {
    name: 'tones',
    render: () => (
      <div className="flex flex-col gap-8">
        {TONES.map((tone) => (
          <Specimen key={tone} label={tone} initial={5} tone={tone} />
        ))}
      </div>
    ),
  },
  {
    // The default: no bounds at all, so the steppers run freely in both
    // directions and negatives are allowed.
    name: 'unbounded',
    render: () => <Specimen label="no min/max" initial={0} />,
  },
];

function PlaygroundFixture(props: Omit<SpecimenProps, 'label'>) {
  return <Specimen label="estimate" {...props} />;
}

export const playground = definePlayground({
  docs: {
    summary:
      'A numeric field with steppers. `value` is `number | null` because an empty field is a real state and not a synonym for zero — clearing it emits `null`, and stepping up from `null` starts at zero rather than at `NaN`.',
  },
  controls: {
    tone: select([...TONE_NAMES], {
      allowNone: true,
      type: 'Tone',
      description:
        'What the field is saying about itself. Unset is the resting field — gray border, accent focus ring — and is NOT a synonym for `primary`.',
    }),
    size: select(SIZES, {
      allowNone: true,
      type: 'ControlSize',
      description: 'Field height — 28 / 36 / 44px. Moves the digits and the steppers with it.',
    }),
    min: number(undefined, {
      allowNone: true,
      description: 'Lower bound. Unset by default — leave it empty for no floor.',
    }),
    max: number(undefined, {
      allowNone: true,
      description: 'Upper bound. Unset by default — leave it empty for no ceiling.',
    }),
    step: number(1, { min: 0.1, max: 10, step: 0.1, description: 'What one stepper press moves.' }),
    disabled: boolean(false, {
      description: 'Not applicable: leaves the tab order and drops out of form submission.',
    }),
    readOnly: boolean(false, {
      description:
        'Not editable, but still focusable and still submitted. Sets HTML `readonly` on the input and neutralises the steppers.',
    }),
  },
  render: (v) => <PlaygroundFixture {...v} initial={5} />,
});
