import { useId, useState } from 'react';
import { Combobox, FieldLabel, type Option } from '@bh/ui';

const STAGES: Option[] = [
  { value: 'ordered', label: 'Ordered', icon: 'circle-dashed', color: 'gray' },
  { value: 'packed', label: 'Packed', icon: 'circle', color: 'gray' },
  { value: 'shipped', label: 'In transit', icon: 'circle-half', color: 'blue' },
  { value: 'nearby', label: 'Out for delivery', icon: 'circle-dot', color: 'purple' },
  { value: 'delivered', label: 'Delivered', icon: 'circle-check', color: 'green' },
];

export function OptionsWithIcons() {
  const id = useId();
  const [stage, setStage] = useState<string | null>('shipped');
  return (
    <div className="flex w-256 flex-col gap-6">
      <FieldLabel htmlFor={id}>Parcel</FieldLabel>
      <Combobox id={id} options={STAGES} value={stage} onChange={setStage} searchable={false} />
    </div>
  );
}
