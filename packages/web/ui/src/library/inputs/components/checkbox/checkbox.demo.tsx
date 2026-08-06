import { useState, type ComponentProps } from 'react';
import { boolean, definePlayground, select, text } from '../../../../gallery';
import { TONE_NAMES } from '../../../../style';
import { Checkbox } from './checkbox';
import type { ControlSize } from '../../contract';

type SpecimenProps = Omit<ComponentProps<typeof Checkbox>, 'value' | 'onChange'> & {
  /** Where the specimen starts. It owns the value from there. */
  initial?: boolean;
};

// The contract is controlled — `value` in, `onChange` out — so every specimen
// needs somewhere to keep the value. One holder, used by both the state
// sections and the playground, rather than `defaultChecked` on a control that
// no longer has one.
function DemoCheckbox({ initial = false, ...props }: SpecimenProps) {
  const [value, setValue] = useState(initial);
  return <Checkbox {...props} value={value} onChange={setValue} />;
}

// The three display states. `indeterminate` is not a value — it rides on top of
// one — so it is a row here rather than a third member of the value domain.
const DISPLAY = [
  { name: 'off', label: 'Off', initial: false, indeterminate: false },
  { name: 'on', label: 'On', initial: true, indeterminate: false },
  { name: 'mixed', label: 'Mixed', initial: false, indeterminate: true },
] as const;

// The three ways a control can be reached. `read-only` is the one worth seeing
// beside `disabled`: it keeps the mark's tone and the text's contrast and loses
// only the affordance, because the value still matters.
const REACH = [
  { suffix: '', props: {} },
  { suffix: ' · disabled', props: { disabled: true } },
  { suffix: ' · read-only', props: { readOnly: true } },
] as const;

const SIZES = ['xs', 'md', 'lg'] as const satisfies readonly ControlSize[];

// A sample, not the whole vocabulary: the point is that the fill and the ring
// follow the ramp, which four tones show as well as seventeen.
const TONES = ['primary', 'success', 'warning', 'danger'] as const;

export const meta = { title: 'Checkbox', group: 'Inputs', size: 'sm' };

export const states = [
  ...DISPLAY.flatMap(({ name, label, initial, indeterminate }) =>
    REACH.map(({ suffix, props }) => ({
      name: `${name}${suffix}`,
      render: () => (
        <DemoCheckbox label={label} initial={initial} indeterminate={indeterminate} {...props} />
      ),
    })),
  ),
  ...SIZES.map((size) => ({
    name: `size ${size}`,
    render: () => <DemoCheckbox label={size} size={size} initial />,
  })),
  ...TONES.map((tone) => ({
    name: `tone ${tone}`,
    render: () => <DemoCheckbox label={tone} tone={tone} initial />,
  })),
  {
    // No label span at all — the name comes from outside, as it does in a
    // table's selection column.
    name: 'unlabelled',
    render: () => <DemoCheckbox aria-label="Select row" initial />,
  },
];

export const playground = definePlayground({
  docs: {
    summary:
      'A boolean control on the shared `ControlProps<boolean>` contract: `value` in, `onChange(next: boolean)` out — never the DOM event. `indeterminate` is a third *display* state that rides on top of the value rather than replacing it.',
  },
  controls: {
    size: select(SIZES, { initial: 'md', type: 'ControlSize' }),
    tone: select([...TONE_NAMES], {
      allowNone: true,
      type: 'Tone',
      description: 'Which ramp the checked fill and focus ring paint from. Defaults to `primary`.',
    }),
    label: text('Notify me', {
      description: 'Optional. Omit it when the control is named through `id` or `aria-label`.',
    }),
    indeterminate: boolean(false, {
      description: 'Draws the dash. Orthogonal to `value`, and set on the DOM node by an effect.',
    }),
    disabled: boolean(false, { description: 'Leaves the tab order and stops responding.' }),
    readOnly: boolean(false, {
      description: 'Stays focusable and keeps its tone, but emits no `onChange`.',
    }),
  },
  render: (v) => <DemoCheckbox {...v} />,
});
