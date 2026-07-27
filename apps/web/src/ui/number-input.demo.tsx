import { useState } from 'react';
import { definePlayground, number, boolean } from '@tickets/ui';
import { NumberInput } from './number-input';

function EstimateFixture() {
  const [estimate, setEstimate] = useState<number | null>(5);
  return <NumberInput value={estimate} onChange={setEstimate} min={0} max={13} />;
}

function PlaygroundFixture({ min, max, disabled }: { min: number; max: number; disabled: boolean }) {
  const [value, setValue] = useState<number | null>(5);
  return <NumberInput value={value} onChange={setValue} min={min} max={max} disabled={disabled} />;
}

export const meta = { title: 'NumberInput', group: 'Form controls', size: 'sm' };

export const states = [
  { name: 'estimate 0–13', render: () => <EstimateFixture /> },
];

export const playground = definePlayground({
  controls: {
    min: number(0, { min: 0, max: 100 }),
    max: number(13, { min: 0, max: 100 }),
    disabled: boolean(),
  },
  render: (v) => <PlaygroundFixture {...v} />,
});
