import { useState } from 'react';
import { definePlayground, text } from '../../gallery';
import { RadioGroup } from './radio-group';

function DensityFixture() {
  const [density, setDensity] = useState('comfortable');
  return (
    <RadioGroup
      name="density"
      label="Density"
      value={density}
      onValueChange={setDensity}
      options={[
        { value: 'comfortable', label: 'Comfortable' },
        { value: 'compact', label: 'Compact' },
        { value: 'off', label: 'Disabled', disabled: true },
      ]}
    />
  );
}

function PlaygroundFixture({ label }: { label: string }) {
  const [value, setValue] = useState('comfortable');
  return (
    <RadioGroup
      name="playground"
      label={label}
      value={value}
      onValueChange={setValue}
      options={[
        { value: 'comfortable', label: 'Comfortable' },
        { value: 'compact', label: 'Compact' },
        { value: 'off', label: 'Disabled', disabled: true },
      ]}
    />
  );
}

export const meta = { title: 'RadioGroup', group: 'Form controls', size: 'lg' };

export const states = [
  { name: 'density', render: () => <DensityFixture /> },
];

export const playground = definePlayground({
  controls: {
    label: text('Density'),
  },
  render: (v) => <PlaygroundFixture {...v} />,
});
