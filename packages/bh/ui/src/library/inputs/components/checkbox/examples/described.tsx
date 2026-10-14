import { useState } from 'react';
import { Checkbox } from '@bh/ui';

export function Described() {
  const [copy, setCopy] = useState(true);
  const [archive, setArchive] = useState(false);
  return (
    <div className="flex max-w-320 flex-col gap-12">
      <Checkbox
        label="Email me a copy"
        description="Sent to the address on your profile, as soon as it is saved."
        value={copy}
        onChange={setCopy}
      />
      <Checkbox
        label="Archive when done"
        description="It leaves the board, and stays in search."
        value={archive}
        onChange={setArchive}
      />
      <Checkbox
        label="Lock the history"
        description="Only an owner can turn this off."
        value
        onChange={() => {}}
        disabled
      />
    </div>
  );
}
