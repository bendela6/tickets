import { useId, useState } from 'react';
import { Combobox, FieldLabel, type ControlSize, type Option } from '@bh/ui';

const CITIES: Option[] = [
  { value: 'lisbon', label: 'Lisbon' },
  { value: 'oslo', label: 'Oslo' },
  { value: 'rome', label: 'Rome' },
];

const SIZES: ControlSize[] = ['xs', 'md', 'lg'];

export function Sizes() {
  const id = useId();
  const [city, setCity] = useState<string | null>('oslo');
  return (
    <div className="flex w-288 flex-col gap-8">
      {SIZES.map((size) => {
        return (
          <div key={size} className="flex items-center gap-12">
            <FieldLabel htmlFor={`${id}-${size}`} className="w-24">
              {size}
            </FieldLabel>
            <Combobox
              id={`${id}-${size}`}
              size={size}
              options={CITIES}
              value={city}
              onChange={setCity}
              className="flex-1"
            />
          </div>
        );
      })}
    </div>
  );
}
