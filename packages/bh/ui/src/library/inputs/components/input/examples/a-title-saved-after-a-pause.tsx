import { useState } from 'react';
import { Input } from '@bh/ui';

export function ATitleSavedAfterAPause() {
  const [title, setTitle] = useState('Quarterly review');
  const [saves, setSaves] = useState(0);
  return (
    <div className="flex w-320 flex-col gap-6">
      <Input
        aria-label="Title"
        size="lg"
        value={title}
        commit={{ after: 800 }}
        onChange={(next) => {
          setTitle(next);
          setSaves((count) => count + 1);
        }}
      />
      <p className="text-12/17 text-gray-11 font-sans">
        {saves === 0
          ? 'Saves 800 ms after you stop typing.'
          : `Saved “${title}”, ${saves} ${saves === 1 ? 'time' : 'times'}`}
      </p>
    </div>
  );
}
