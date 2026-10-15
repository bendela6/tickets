import { Fragment, useState } from 'react';
import { Button, RelativeDate } from '@bh/ui';

const MINUTE = 60_000;

// Two moments set from when the example opened, each a little short of its
// label's next step, so each turns within a minute or two of watching.
const BEFORE = [
  { note: '30 s before it opened', ms: 30_000 },
  { note: '59 min 30 s before', ms: 59 * MINUTE + 30_000 },
];

export function StaysCurrent() {
  const [opened] = useState(() => Date.now());
  const [savedAt, setSavedAt] = useState<string>();
  return (
    <div className="flex flex-col items-start gap-12">
      <div className="grid grid-cols-2 items-baseline gap-x-24 gap-y-8">
        {BEFORE.map(({ note, ms }) => {
          return (
            <Fragment key={note}>
              <span className="text-12/17 text-gray-9 font-mono">{note}</span>
              <RelativeDate value={new Date(opened - ms).toISOString()} smallestUnit="minute" />
            </Fragment>
          );
        })}
      </div>
      <p className="text-13/19 text-gray-11">
        {savedAt === undefined ? (
          'Not saved yet'
        ) : (
          <>
            Saved <RelativeDate value={savedAt} smallestUnit="minute" />
          </>
        )}
      </p>
      <Button onClick={() => setSavedAt(new Date().toISOString())}>Save</Button>
    </div>
  );
}
