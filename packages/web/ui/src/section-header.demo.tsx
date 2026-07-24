import { definePlayground, text } from './gallery';
import { Meter } from './meter';
import { SectionHeader } from './section-header';

export const meta = { title: 'SectionHeader', group: 'Display', size: 'lg' };

export const states = [
  { name: 'Title only', render: () => <SectionHeader title="Fields" /> },
  {
    name: 'Title + count (compound, e.g. progress readout)',
    render: () => (
      <SectionHeader
        title="Subtasks"
        count={
          <>
            <Meter tone="green" value={60} max={100} className="w-15" />
            <span className="font-mono text-label text-ink-3">3/5 done</span>
          </>
        }
        className="gap-2.5"
      />
    ),
  },
  {
    name: 'Title + action (right-aligned)',
    render: () => (
      <SectionHeader
        title="Links"
        action={
          <button type="button" className="font-sans text-meta font-medium text-ink-3 hover:text-ink">
            ＋ Add link
          </button>
        }
      />
    ),
  },
  {
    name: 'Title with an inline required marker',
    render: () => (
      <SectionHeader
        title={
          <>
            Name<span className="text-danger"> *</span>
          </>
        }
      />
    ),
  },
];

export const playground = definePlayground({
  controls: {
    title: text('Subtasks'),
  },
  render: (v) => <SectionHeader title={v.title} />,
});
