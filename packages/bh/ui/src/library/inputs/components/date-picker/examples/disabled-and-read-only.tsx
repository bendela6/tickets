import { useId, useState } from 'react';
import { DatePicker, FieldLabel } from '@bh/ui';

export function DisabledAndReadOnly() {
  const id = useId();
  const [opened, setOpened] = useState<string | null>('2026-07-01T00:00:00Z');
  const [closed, setClosed] = useState<string | null>('2026-07-31T00:00:00Z');
  return (
    <div className="flex w-208 flex-col gap-12">
      <div className="flex flex-col gap-4">
        <FieldLabel htmlFor={`${id}-opened`}>Opened</FieldLabel>
        <DatePicker id={`${id}-opened`} disabled value={opened} onChange={setOpened} />
      </div>
      <div className="flex flex-col gap-4">
        <FieldLabel htmlFor={`${id}-closed`}>Closed</FieldLabel>
        <DatePicker id={`${id}-closed`} readOnly value={closed} onChange={setClosed} />
      </div>
    </div>
  );
}
