import { RelativeDate } from '@bh/ui';

const NOW = new Date('2026-07-06T09:00:00Z');

export function Overdue() {
  return (
    <div className="flex flex-col gap-4">
      <RelativeDate value="2026-07-03T09:00:00Z" now={NOW} overdue />
      <RelativeDate value="2026-07-09T09:00:00Z" now={NOW} />
    </div>
  );
}
