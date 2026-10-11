import { useState } from 'react';
import { Switch } from '@bh/ui';

export function Pending() {
  const [value, setValue] = useState(false);
  const [pending, setPending] = useState(false);
  return (
    <Switch
      label="Back up photos"
      value={value}
      pending={pending}
      onChange={(next) => {
        setValue(next);
        setPending(true);
        // Stands in for the save; on a real failure, set the value back.
        setTimeout(() => setPending(false), 1500);
      }}
    />
  );
}
