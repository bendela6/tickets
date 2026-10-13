import { useState } from 'react';
import { NumberInput } from '@bh/ui';

export function AnEstimateSavedOnLeaving() {
  const [hours, setHours] = useState<number | null>(3);
  const [draft, setDraft] = useState<number | null>(hours);
  const [saves, setSaves] = useState(0);
  return (
    <div className="flex w-256 flex-col gap-6">
      <NumberInput
        aria-label="Estimate, in hours"
        value={hours}
        min={0}
        commit="leave"
        onDraft={setDraft}
        onChange={(next) => {
          setHours(next);
          setSaves((count) => count + 1);
        }}
      />
      <p className="text-12/17 text-gray-11 font-sans">
        Draft <span className="text-gray-12 font-mono">{draft ?? 'empty'}</span>, saved{' '}
        <span className="text-gray-12 font-mono">{hours ?? 'empty'}</span>, {saves}{' '}
        {saves === 1 ? 'save' : 'saves'}
      </p>
    </div>
  );
}
