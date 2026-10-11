import { useId, useState } from 'react';
import { FieldLabel, IconPicker } from '@bh/ui';

export function DisabledAndReadOnly() {
  const id = useId();
  const [icon, setIcon] = useState<string | null>('tag');
  return (
    <div className="flex w-256 flex-col gap-12">
      <div className="flex flex-col gap-6">
        <FieldLabel htmlFor={`${id}-disabled`}>Disabled</FieldLabel>
        <IconPicker id={`${id}-disabled`} disabled value={icon} onChange={setIcon} />
      </div>
      <div className="flex flex-col gap-6">
        <FieldLabel htmlFor={`${id}-read-only`}>Read-only</FieldLabel>
        <IconPicker id={`${id}-read-only`} readOnly value={icon} onChange={setIcon} />
      </div>
    </div>
  );
}
