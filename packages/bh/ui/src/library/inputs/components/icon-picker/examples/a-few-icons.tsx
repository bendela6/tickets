import { useId, useState } from 'react';
import { FieldLabel, IconPicker } from '@bh/ui';

export function AFewIcons() {
  const id = useId();
  const [icon, setIcon] = useState<string | null>(null);
  return (
    <div className="flex w-256 flex-col gap-6">
      <FieldLabel htmlFor={id}>Icon</FieldLabel>
      <IconPicker
        id={id}
        icons={['folder', 'file', 'terminal', 'calendar', 'tag']}
        value={icon}
        onChange={setIcon}
      />
    </div>
  );
}
