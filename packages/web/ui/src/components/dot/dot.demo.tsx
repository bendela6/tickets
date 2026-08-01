import { Dot } from './dot';

export const meta = { title: 'Dot', group: 'Components', size: 'sm' };

const HUES = ['blue', 'green', 'orange', 'purple', 'teal'] as const;

export const states = [
  {
    name: 'Colours',
    render: () => (
      <div className="flex flex-wrap items-center gap-3">
        {HUES.map((h) => (
          <Dot key={h} color={`var(--color-${h}-9)`} />
        ))}
      </div>
    ),
  },
  {
    name: 'Hollow',
    render: () => (
      <div className="flex flex-wrap items-center gap-3">
        <Dot color="var(--color-blue-9)" />
        <Dot color="var(--color-blue-9)" hollow />
      </div>
    ),
  },
  {
    name: 'Beside text',
    render: () => (
      <div className="flex items-center gap-2 text-13 text-gray-12">
        <Dot color="var(--color-green-9)" />
        <span>Workspace</span>
      </div>
    ),
  },
];
