import { useState } from 'react';
import { definePlayground, number, select, boolean } from '../../gallery';
import { TONE_NAMES } from '../../style';
import { Slider } from './slider';

const SIZES = ['sm', 'md'] as const;

function DemoSlider({
  initial = 50,
  min = 0,
  max = 100,
  step = 1,
  size,
  tone,
  disabled,
  suffix = '%',
}: {
  initial?: number;
  min?: number;
  max?: number;
  step?: number;
  size?: (typeof SIZES)[number];
  tone?: (typeof TONE_NAMES)[number];
  disabled?: boolean;
  suffix?: string;
}) {
  const [value, setValue] = useState(initial);
  return (
    <div className="flex w-64 items-center gap-3">
      <Slider
        label="Opacity"
        value={value}
        onChange={setValue}
        min={min}
        max={max}
        step={step}
        size={size}
        tone={tone}
        disabled={disabled}
        valueText={`${value}${suffix}`}
      />
      <span className="w-10 shrink-0 text-right font-mono text-12 text-gray-11">
        {value}
        {suffix}
      </span>
    </div>
  );
}

export const meta = { title: 'Slider', group: 'Components', size: 'sm' };

export const states = [
  { name: 'Default', render: () => <DemoSlider /> },
  { name: 'Small', render: () => <DemoSlider size="sm" /> },
  { name: 'Fractional steps', render: () => <DemoSlider initial={1} min={0} max={2} step={0.1} suffix="×" /> },
  { name: 'Disabled', render: () => <DemoSlider disabled /> },
];

export const playground = definePlayground({
  docs: {
    summary:
      'A single-value slider with the full keyboard contract — arrows by step, PageUp/PageDown by a tenth of the range, Home/End to the ends. It is a `role="slider"` div rather than `<input type="range">`: a native range exposes its track and thumb only through vendor pseudo-elements, which no utility class can target, so tokenising one would mean a hand-written stylesheet per engine.',
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
    size: select(SIZES, { initial: 'md', type: 'SliderSize', description: 'Track thickness.' }),
    tone: select([...TONE_NAMES], {
      allowNone: true,
      type: 'Tone',
      description: 'Which ramp the fill and focus ring paint from. Defaults to `primary`.',
    }),
    disabled: boolean(false, { description: 'Leaves the tab order and stops responding.' }),
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
    />
  ),
});
