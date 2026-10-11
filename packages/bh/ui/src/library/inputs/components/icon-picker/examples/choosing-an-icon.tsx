import { useId, useState } from 'react';
import { FieldLabel, IconPicker } from '@bh/ui';

export function ChoosingAnIcon() {
  const id = useId();
  const [icon, setIcon] = useState<string | null>('folder');
  return (
    <div className="flex w-256 flex-col gap-6">
      <FieldLabel htmlFor={id}>Icon</FieldLabel>
      <IconPicker id={id} value={icon} onChange={setIcon} />
    </div>
  );
}
