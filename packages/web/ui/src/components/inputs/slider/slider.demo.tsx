import { useState } from 'react';
import { definePlayground, number, select, boolean } from '../../../gallery';
import { TONE_NAMES } from '../../../style';
import { Slider } from './slider';
import type { ControlSize } from '../control';

const SIZES = ['sm', 'md', 'lg'] as const satisfies readonly ControlSize[];

// The coverage axes, as data — every state below is derived from one of these,
// so a new rung or a new interaction expands the page without anyone editing
// the list by hand.

/** Where the thumb sits inside the default 0–100 range. The ends are the
 *  interesting ones: an empty fill and a full one are the two the width
 *  arithmetic gets wrong. */
const POSITIONS = [
  { name: 'at min', initial: 0 },
  { name: 'mid-range', initial: 50 },
  { name: 'at max', initial: 100 },
] as const;

/** Ranges that are not the default one. `quantise` anchors the grid at `min`,
 *  so a range starting at 20 must land on 20/25/30 and never on a multiple of
 *  the step alone — which is only visible with a non-zero min. */
const RANGES = [
  { name: 'fractional steps', label: 'Scale', min: 0, max: 2, step: 0.1, initial: 1, suffix: '×' },
  {
    name: 'from a non-zero min',
    label: 'Threshold',
    min: 20,
    max: 80,
    step: 5,
    initial: 35,
    suffix: '',
  },
] as const;

/** The three ways the control answers to input. `disabled` leaves the tab
 *  order; `readOnly` keeps it and only stops emitting. */
const INTERACTIONS = [
  { name: 'rest', props: {} },
  { name: 'disabled', props: { disabled: true } },
  { name: 'read-only', props: { readOnly: true } },
] as const;

function DemoSlider({
  initial = 50,
  min = 0,
  max = 100,
  step = 1,
  label = 'Opacity',
  size,
  tone,
  disabled,
  readOnly,
  suffix = '%',
}: {
  initial?: number;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  size?: ControlSize;
  tone?: (typeof TONE_NAMES)[number];
  disabled?: boolean;
  readOnly?: boolean;
  suffix?: string;
}) {
  const [value, setValue] = useState(initial);
  return (
    <div className="flex w-256 items-center gap-12">
      <Slider
        label={label}
        value={value}
        onChange={setValue}
        min={min}
        max={max}
        step={step}
        size={size}
        tone={tone}
        disabled={disabled}
        readOnly={readOnly}
        valueText={`${value}${suffix}`}
      />
      <span className="w-40 shrink-0 text-right font-mono text-12 text-gray-11">
        {value}
        {suffix}
      </span>
    </div>
  );
}

export const meta = { title: 'Slider', group: 'Inputs', size: 'sm' };

export const states = [
  // Content: the thumb at both ends and in the middle.
  ...POSITIONS.map((position) => ({
    name: `value: ${position.name}`,
    render: () => <DemoSlider initial={position.initial} />,
  })),
  // Content: ranges the default one does not cover.
  ...RANGES.map((range) => ({
    name: `range: ${range.name}`,
    render: () => (
      <DemoSlider
        label={range.label}
        initial={range.initial}
        min={range.min}
        max={range.max}
        step={range.step}
        suffix={range.suffix}
      />
    ),
  })),
  // Interaction. Read-only is the one to look at: same tone, same readable
  // value, no cursor affordance — and still a tab stop, which no screenshot
  // shows.
  ...INTERACTIONS.map((interaction) => ({
    name: `state: ${interaction.name}`,
    render: () => <DemoSlider {...interaction.props} />,
  })),
  // Every rung, including the `lg` that only exists because a slider beside a
  // 44px field had nothing to match.
  ...SIZES.map((size) => ({
    name: `size: ${size}`,
    render: () => <DemoSlider size={size} />,
  })),
  // The tone axis in one place. Each fill is a class built by interpolation, so
  // this is also the check that the generated safelist reached the stylesheet:
  // if it did not, these render as empty tracks.
  {
    name: 'tones',
    render: () => (
      <div className="flex flex-col gap-12">
        {TONE_NAMES.map((tone) => (
          <DemoSlider key={tone} tone={tone} label={`Opacity (${tone})`} initial={65} />
        ))}
      </div>
    ),
  },
];

export const playground = definePlayground({
  docs: {
    summary:
      'A single-value slider with the full keyboard contract — arrows by step, PageUp/PageDown by a tenth of the range, Home/End to the ends. It is a `role="slider"` div rather than `<input type="range">`: a native range exposes its track and thumb only through vendor pseudo-elements, which no utility class can target, so tokenising one would mean a hand-written stylesheet per engine. `label` is required and has to be a prop for the same reason: `for` binds only to labelable elements, and a div is not one.',
  },
  controls: {
    min: number(0, { min: -100, max: 0, step: 10, description: 'Lower bound.' }),
    max: number(100, { min: 10, max: 200, step: 10, description: 'Upper bound.' }),
    step: number(1, {
      min: 0.1,
      max: 25,
      step: 0.1,
      description: 'Grid the value snaps to, anchored at `min` rather than at zero.',
    }),
    size: select(SIZES, { initial: 'md', type: 'ControlSize', description: 'Track thickness.' }),
    tone: select([...TONE_NAMES], {
      allowNone: true,
      type: 'Tone',
      description: 'Which ramp the fill and focus ring paint from. Defaults to `primary`.',
    }),
    disabled: boolean(false, { description: 'Leaves the tab order and stops responding.' }),
    readOnly: boolean(false, {
      description:
        'Keeps the tab stop and the value, stops emitting. Sets `aria-readonly` — never `aria-disabled`.',
    }),
  },
  render: (v) => (
    <DemoSlider
      min={v.min}
      max={v.max}
      step={v.step}
      initial={Math.round((v.min + v.max) / 2)}
      size={v.size}
      tone={v.tone}
      disabled={v.disabled}
      readOnly={v.readOnly}
    />
  ),
});
