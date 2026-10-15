import { useState } from 'react';
import { useNow } from '@bh/hooks';

// How long ago a note was saved, said again each second, and a clock that
// turns on the minute: plain text and a button, no component of bh's.

const BUTTON = 'rounded-8 border-gray-6 border-1 px-12 py-6';

function ago(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return seconds < 60 ? `${String(seconds)} s ago` : `${String(Math.floor(seconds / 60))} min ago`;
}

export function SavedAWhileAgo() {
  const [savedAt, setSavedAt] = useState<number>();
  const [ticking, setTicking] = useState(true);
  const now = useNow({ enabled: ticking });
  const minute = useNow({ interval: 60_000 });
  return (
    <div className="flex flex-col items-start gap-8">
      <p className="text-13/19 text-gray-11 tabular-nums">
        {savedAt === undefined ? 'Not saved yet' : `Saved ${ago(now - savedAt)}`}
      </p>
      <div className="flex gap-8">
        <button type="button" className={BUTTON} onClick={() => setSavedAt(Date.now())}>
          Save
        </button>
        <button type="button" className={BUTTON} onClick={() => setTicking(!ticking)}>
          {ticking ? 'Stop the clock' : 'Start the clock'}
        </button>
      </div>
      <p className="text-12/17 text-gray-10 font-mono" suppressHydrationWarning>
        {new Date(minute).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </p>
    </div>
  );
}
