import { definePlayground, text } from '../../gallery';
import { RailLabel } from './rail-label';

export const meta = { title: 'RailLabel', group: 'Ungrouped', size: 'sm' };

export const states = [
  { name: 'Default', render: () => <RailLabel>AGENTS</RailLabel> },
  {
    name: 'In a row with trailing actions',
    render: () => (
      <div className="flex w-56 items-center justify-between">
        <RailLabel>TERMINALS</RailLabel>
        <span className="font-sans text-meta text-indigo-9">＋ New</span>
      </div>
    ),
  },
];

export const playground = definePlayground({
  docs: {
    summary:
      'The small mono caption that titles a rail section or a control group — CONTROLS, AGENTS, STATES. It exists so the uppercase-mono-tracking recipe lives in one place instead of being retyped at every rail.',
  },
  controls: {
    children: text('AGENTS', {
      type: 'ReactNode',
      required: true,
      description:
        'The caption. Write it in the case you want to see: the component sets the tracking and size but does not transform the text.',
    }),
  },
  render: (v) => <RailLabel>{v.children}</RailLabel>,
});
