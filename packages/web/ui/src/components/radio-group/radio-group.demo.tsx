import { useState } from 'react';
import { definePlayground, select, text } from '../../gallery';
import { TONE_NAMES } from '../../style';
import { RadioGroup } from './radio-group';
import type { ControlSize } from '../control';

function DensityFixture({ variant }: { variant?: 'plain' | 'card' } = {}) {
  const [density, setDensity] = useState('comfortable');
  return (
    <RadioGroup
      name={`density-${variant ?? 'plain'}`}
      label="Density"
      variant={variant}
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
  variant,
  size,
  tone,
}: {
  label: string;
  variant: 'plain' | 'card';
  size: 'sm' | 'md' | 'lg';
  tone?: (typeof TONE_NAMES)[number];
}) {
  const [value, setValue] = useState('comfortable');
  return (
    <RadioGroup
      name="playground"
      label={label}
      variant={variant}
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
  { name: 'plain', render: () => <DensityFixture /> },
  { name: 'card', render: () => <DensityFixture variant="card" /> },
];

export const playground = definePlayground({
  controls: {
    variant: select(['plain', 'card'] as const, { initial: 'plain', type: 'RadioGroupVariant' }),
    size: select(['sm', 'md', 'lg'] as const, { initial: 'md', type: 'ControlSize' }),
    tone: select([...TONE_NAMES], { allowNone: true, type: 'Tone' }),
    label: text('Density'),
  },
  render: (v) => <PlaygroundFixture {...v} />,
});
