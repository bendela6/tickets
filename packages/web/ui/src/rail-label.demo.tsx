import { definePlayground, text } from './gallery';
import { RailLabel } from './rail-label';

export const meta = { title: 'RailLabel', group: 'Display', size: 'sm' };

export const states = [
  { name: 'Default', render: () => <RailLabel>AGENTS</RailLabel> },
  {
    name: 'In a row with trailing actions',
    render: () => (
      <div className="flex w-56 items-center justify-between">
        <RailLabel>TERMINALS</RailLabel>
        <span className="font-sans text-meta text-accent">＋ New</span>
      </div>
    ),
  },
];

export const playground = definePlayground({
  controls: {
    children: text('AGENTS'),
  },
  render: (v) => <RailLabel>{v.children}</RailLabel>,
});
