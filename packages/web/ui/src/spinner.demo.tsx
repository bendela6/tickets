import { definePlayground, number, select } from './gallery';
import { TONE_NAMES } from './tones';
import { Spinner } from './spinner';

export const meta = { title: 'Spinner', group: 'Display' };

export const states = [
  {
    name: 'Sizes',
    render: () => (
      <div className="flex items-center gap-4">
        <Spinner size={11} tone="primary" />
        <Spinner size={14} tone="primary" />
        <Spinner size={20} tone="primary" />
        <Spinner size={28} tone="primary" />
      </div>
    ),
  },
  {
    name: 'Tones',
    render: () => (
      <div className="flex items-center gap-4">
        {TONE_NAMES.map((tone) => (
          <Spinner key={tone} tone={tone} />
        ))}
      </div>
    ),
  },
];

export const playground = definePlayground({
  controls: {
    size: number(14, { min: 10, max: 40 }),
    tone: select(TONE_NAMES, { initial: 'primary' }),
  },
  render: (v) => <Spinner size={v.size} tone={v.tone} />,
});
