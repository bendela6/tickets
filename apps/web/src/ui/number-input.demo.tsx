import { useState } from 'react';
import { NumberInput } from './number-input';

function EstimateFixture() {
  const [estimate, setEstimate] = useState<number | null>(5);
  return <NumberInput value={estimate} onChange={setEstimate} min={0} max={13} />;
}

export const meta = { title: 'NumberInput', group: 'Form controls' };

export const states = [
  { name: 'estimate 0–13', render: () => <EstimateFixture /> },
];
