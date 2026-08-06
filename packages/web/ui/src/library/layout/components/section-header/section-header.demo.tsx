import { definePlayground, text } from '../../../../gallery';
import { Progress } from '../../../feedback/components/progress';
import { SectionHeader } from './section-header';

export const meta = { title: 'SectionHeader', group: 'Deprecated', size: 'lg' };

export const states = [
  { name: 'Title only', render: () => <SectionHeader title="Fields" /> },
  {
    name: 'Title + count (compound, e.g. progress readout)',
    render: () => (
      <SectionHeader
        title="Subtasks"
        count={
          <>
            <Progress tone="green" value={60} className="w-60" />
            <span className="font-mono text-11/13 tracking-wider text-gray-9">3/5 done</span>
          </>
        }
        className="gap-10"
      />
    ),
  },
  {
    name: 'Title + action (right-aligned)',
    render: () => (
      <SectionHeader
        title="Links"
        action={
          <button type="button" className="font-sans text-12/17 font-500 text-gray-9 hover:text-gray-12">
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
            Name<span className="text-red-9"> *</span>
          </>
        }
      />
    ),
  },
];

export const playground = definePlayground({
  docs: {
    summary:
      'A section title with an optional count and a trailing action, on one baseline. Renders a plain `div` by default; pass `as="h2"` when the section deserves a real heading in the accessibility tree.',
  },
  controls: {
    title: text('Subtasks', {
      type: 'ReactNode',
      required: true,
      description:
        'The section name. Restyle it through `titleClassName` rather than `className` — the latter lands on the row and cannot reach the title’s own text classes.',
    }),
  },
  render: (v) => <SectionHeader title={v.title} />,
});
