import { boolean, definePlayground, text } from '../../../../docs/gallery';
import { RelativeDate } from './relative-date';

// Fixed reference instant so RelativeDate output is deterministic in the gallery.
const NOW = new Date('2026-07-06T00:00:00Z');

export const meta = { title: 'Relative Date', deprecated: true, order: 7, size: 'sm' };

export const states = [
  {
    name: 'today',
    render: () => <RelativeDate value="2026-07-06T00:00:00Z" now={NOW} />,
  },
  {
    name: 'in-3-days',
    render: () => <RelativeDate value="2026-07-09T00:00:00Z" now={NOW} />,
  },
  {
    name: 'overdue',
    render: () => <RelativeDate value="2026-07-03T00:00:00Z" now={NOW} overdue />,
  },
];

export const playground = definePlayground({
  controls: {
    value: text('2026-07-09T00:00:00Z'),
    overdue: boolean(),
  },
  render: ({ value, overdue }) => <RelativeDate value={value} now={NOW} overdue={overdue} />,
});
