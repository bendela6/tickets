import { useState } from 'react';
import { boolean, definePlayground, number, select } from '../../gallery';
import { TONE_NAMES } from '../../style';
import { NumberInput } from './number-input';

function EstimateFixture() {
  const [estimate, setEstimate] = useState<number | null>(5);
  return <NumberInput value={estimate} onChange={setEstimate} min={0} max={13} />;
}

function UnboundedFixture() {
  const [value, setValue] = useState<number | null>(0);
  return <NumberInput value={value} onChange={setValue} />;
}

function PlaygroundFixture({
  min,
  max,
  disabled,
  tone,
}: {
  min?: number;
  max?: number;
  disabled: boolean;
  tone?: (typeof TONE_NAMES)[number];
}) {
  const [value, setValue] = useState<number | null>(5);
  return (
    <NumberInput
      value={value}
      onChange={setValue}
      min={min}
      max={max}
      tone={tone}
      disabled={disabled}
    />
  );
}

export const meta = { title: 'NumberInput', group: 'Components', size: 'sm' };

export const states = [
  { name: 'estimate 0–13', render: () => <EstimateFixture /> },
  // The default: no bounds at all, so the steppers run freely in both
  // directions and negatives are allowed.
  { name: 'unbounded', render: () => <UnboundedFixture /> },
];

export const playground = definePlayground({
  controls: {
    tone: select([...TONE_NAMES], { allowNone: true }),
    min: number(undefined, {
      allowNone: true,
      description: 'Lower bound. Unset by default — leave it empty for no floor.',
    }),
    max: number(undefined, {
      allowNone: true,
      description: 'Upper bound. Unset by default — leave it empty for no ceiling.',
    }),
    disabled: boolean(),
  },
  render: (v) => <PlaygroundFixture {...v} />,
});
