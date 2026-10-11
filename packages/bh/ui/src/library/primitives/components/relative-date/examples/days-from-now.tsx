import { RelativeDate } from '@bh/ui';

const NOW = new Date('2026-07-06T09:00:00Z');

export function DaysFromNow() {
  return (
    <div className="flex flex-col gap-4">
      <RelativeDate value="2026-07-03T09:00:00Z" now={NOW} />
      <RelativeDate value="2026-07-05T18:30:00Z" now={NOW} />
      <RelativeDate value="2026-07-06T23:00:00Z" now={NOW} />
      <RelativeDate value="2026-07-07T08:00:00Z" now={NOW} />
      <RelativeDate value="2026-07-13T09:00:00Z" now={NOW} />
    </div>
  );
}
