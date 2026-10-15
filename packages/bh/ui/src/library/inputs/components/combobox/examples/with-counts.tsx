import { useId, useState } from 'react';
import { Combobox, FieldLabel, type Option } from '@bh/ui';

const PROJECTS: Option[] = [
  { value: 'bh', label: 'bh', count: 128 },
  { value: 'gateway', label: 'gateway', count: 31 },
  { value: 'medialib', label: 'medialib', count: 12 },
  { value: 'cv', label: 'cv', count: 2 },
];

export function WithCounts() {
  const id = useId();
  const [value, setValue] = useState<string | null>(null);
  return (
    <div className="flex w-256 flex-col gap-6">
      <FieldLabel htmlFor={id}>Project</FieldLabel>
      <Combobox
        id={id}
        options={PROJECTS}
        value={value}
        onChange={setValue}
        placeholder="All projects"
        searchable={false}
      />
    </div>
  );
}
