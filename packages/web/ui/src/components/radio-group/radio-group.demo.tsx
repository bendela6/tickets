import { useState } from 'react';
import { definePlayground, select, text } from '../../gallery';
import { TONE_NAMES } from '../../style';
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

function PlaygroundFixture({
  label,
  size,
  tone,
}: {
  label: string;
  size: 'sm' | 'md' | 'lg';
  tone?: (typeof TONE_NAMES)[number];
}) {
  const [value, setValue] = useState('comfortable');
  return (
    <RadioGroup
      name="playground"
      label={label}
      size={size}
      tone={tone}
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

export const meta = { title: 'RadioGroup', group: 'Components', size: 'lg' };

export const states = [
  { name: 'density', render: () => <DensityFixture /> },
];

export const playground = definePlayground({
  controls: {
    size: select(['sm', 'md', 'lg'] as const, { initial: 'md', type: 'ToggleSize' }),
    tone: select([...TONE_NAMES], { allowNone: true, type: 'Tone' }),
    label: text('Density'),
  },
  render: (v) => <PlaygroundFixture {...v} />,
});
