import { useState } from 'react';
import { Field, FoldCard, Input } from '@bh/ui';

export function Controlled() {
  const [open, setOpen] = useState(true);
  const [name, setName] = useState('north-wing');
  return (
    <FoldCard
      title="Project"
      summary={name || 'No name yet'}
      open={open}
      onOpenChange={setOpen}
      className="w-480 max-w-full"
    >
      <Field id="fold-card-name" label="Name" hint="Its files are named after it.">
        <Input id="fold-card-name" value={name} onChange={setName} className="font-mono" />
      </Field>
    </FoldCard>
  );
}
