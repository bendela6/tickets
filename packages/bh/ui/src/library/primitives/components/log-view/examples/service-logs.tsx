import { useEffect, useState } from 'react';
import { LogView, type LogLine, type LogRule } from '@bh/ui';

// The service's own marks: its level in green, the JSON it adds dimmed.
const RULES: readonly LogRule[] = [
  { match: /(?<=^\[)info(?=\])/, tone: 'success' },
  { match: /\{.*\}$/, tone: 'quiet' },
];

const JOBS = [
  '[info][Jobs]: Starting scheduled job: Plex Watchlist Sync',
  '[info][Jobs]: Starting scheduled job: Plex Recently Added Scan',
  '[info][Plex Scan]: Scan starting {"sessionId":"f76dea29-2949-4b3f-9234-36e56b4f63b7"}',
  '[info][Plex Scan]: Beginning to process recently added for library: Movies {"lastScan":1791495300020}',
  '[info][Plex Scan]: Beginning to process recently added for library: Series {"lastScan":1791495300023}',
  '[info][Plex Scan]: Recently Added Scan Complete',
];

// The last lines a container printed: a tail, its start moving on once it
// is full, so each line has an id that keeps its place.
const TAIL = 200;

function lineAt(index: number, time: number): LogLine {
  return { id: index, time, text: JOBS[index % JOBS.length] ?? '' };
}

/** The container's log, a line a second, kept to its last 200. */
function useContainerLog(): LogLine[] {
  const [lines, setLines] = useState<LogLine[]>(() => {
    const now = Date.now();
    return Array.from({ length: 12 }, (_, index) => lineAt(index, now - (12 - index) * 4000));
  });
  useEffect(() => {
    const timer = setInterval(() => {
      setLines((before) => {
        const next = lineAt((before.at(-1)?.id as number) + 1, Date.now());
        return [...before, next].slice(-TAIL);
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  return lines;
}

export function ServiceLogs() {
  const lines = useContainerLog();
  return (
    <LogView lines={lines} rules={RULES} streaming label="medialib-seerr-1" className="w-full" />
  );
}
