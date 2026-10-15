import { Fragment } from 'react';
import { RelativeDate } from '@bh/ui';

const NOW = new Date('2026-07-06T09:00:00Z');
const MOMENTS = [
  '2026-07-06T08:59:40Z',
  '2026-07-06T08:55:00Z',
  '2026-07-06T06:30:00Z',
  '2026-07-06T11:00:00Z',
  '2026-07-05T08:00:00Z',
];

export function MinutesAndHours() {
  return (
    <div className="grid grid-cols-2 items-baseline gap-x-24 gap-y-8">
      <span className="text-12/17 text-gray-9 font-mono">minute</span>
      <span className="text-12/17 text-gray-9 font-mono">day, the default</span>
      {MOMENTS.map((moment) => {
        return (
          <Fragment key={moment}>
            <RelativeDate value={moment} now={NOW} smallestUnit="minute" />
            <RelativeDate value={moment} now={NOW} />
          </Fragment>
        );
      })}
    </div>
  );
}
