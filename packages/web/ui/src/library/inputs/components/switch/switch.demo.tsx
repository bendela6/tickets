import { useState } from 'react';
import { boolean, definePlayground, select, text } from '../../../../docs/gallery';
import { ROLES, TONE_NAMES, type Tone } from '../../../../style';
import { Switch } from './switch';
import type { ControlSize } from '../../contract';

const SIZES = ['xs', 'md', 'lg'] as const satisfies readonly ControlSize[];

/**
 * The switch is controlled — `value` in, `value` out — so every specimen owns
 * a piece of state. Written once here rather than per state so the matrix below
 * can be derived instead of hand-written.
 */
function DemoSwitch({
  initial = false,
  label,
  size,
  tone,
  disabled,
  readOnly,
  id,
}: {
  initial?: boolean;
  label?: string;
  size?: ControlSize;
  tone?: Tone;
  disabled?: boolean;
  readOnly?: boolean;
  id?: string;
}) {
  const [value, setValue] = useState(initial);
  return (
    <Switch
      id={id}
      label={label}
      value={value}
      onChange={setValue}
      size={size}
      tone={tone}
      disabled={disabled}
      readOnly={readOnly}
    />
  );
}

// The two axes that cross: what the switch holds, and whether it may be
// changed. Crossed rather than listed, because the interesting cases are the
// intersections — a disabled ON switch and a read-only ON switch have to look
// different from each other, and from an OFF one.
const VALUES = [
  { name: 'off', initial: false },
  { name: 'on', initial: true },
] as const;

const MODES = [
  { name: 'rest', props: {} },
  { name: 'disabled', props: { disabled: true } },
  { name: 'read-only', props: { readOnly: true } },
] as const;

export const meta = { title: 'Switch', size: 'sm' };

export const states = [
  ...MODES.flatMap((mode) =>
    VALUES.map((value) => ({
      name: `${value.name} · ${mode.name}`,
      render: () => (
        <DemoSwitch label="KPI strip" initial={value.initial} {...mode.props} />
      ),
    })),
  ),
  ...SIZES.map((size) => ({
    name: `size ${size}`,
    render: () => (
      <div className="flex flex-col gap-8">
        <DemoSwitch size={size} label={`${size} off`} />
        <DemoSwitch size={size} label={`${size} on`} initial />
      </div>
    ),
  })),
  {
    name: 'tones',
    render: () => (
      <div className="flex flex-col gap-8">
        {ROLES.map((tone) => (
          <DemoSwitch key={tone} tone={tone} label={tone} initial />
        ))}
      </div>
    ),
  },
  {
    // No label span at all: the switch is named from outside through `id`, the
    // arrangement a field row or the playground's controls panel uses.
    name: 'no label',
    render: () => (
      <div className="flex items-center gap-8">
        <label htmlFor="switch-demo-external" className="font-sans text-13/19 text-gray-12">
          Named from outside
        </label>
        <DemoSwitch id="switch-demo-external" initial />
      </div>
    ),
  },
];

export const playground = definePlayground({
  docs: {
    summary:
      'A boolean control on the shared contract: it takes `value` and hands back a `boolean` from `onChange`, never the DOM event. `label` is optional — leave it off when a field caption or a settings row already names the switch through `id`. `readOnly` locks the value while keeping the tab stop; reach for `disabled` only when the switch does not apply at all.',
  },
  controls: {
    size: select(SIZES, {
      initial: 'md',
      type: 'ControlSize',
      description: 'Track height — 16 / 18 / 22px, on the shared control ladder.',
    }),
    tone: select([...TONE_NAMES], {
      allowNone: true,
      type: 'Tone',
      description: 'Which ramp the on-state track and focus ring paint from. Defaults to `primary`.',
    }),
    label: text('KPI strip', {
      description: 'Inline copy beside the track. Optional — omit it when the switch is named through `id`.',
    }),
    disabled: boolean(false, {
      description: 'Not applicable: leaves the tab order and drops out of form submission.',
    }),
    readOnly: boolean(false, {
      description:
        'Not editable, but still focusable and still submitted. Sets `aria-readonly` and refuses to emit — HTML’s `readonly` does not apply to a checkbox.',
    }),
  },
  render: (v) => (
    <DemoSwitch
      label={v.label}
      size={v.size}
      tone={v.tone}
      disabled={v.disabled}
      readOnly={v.readOnly}
    />
  ),
});
