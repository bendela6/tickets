import { definePlayground, number, select } from '../../gallery';
import { TONE_NAMES } from '../../style/tones';
import { Spinner } from './spinner';

export const meta = { title: 'Spinner', group: 'Display', size: 'md' };

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
    // Wraps like the Icon registry does: this enumerates every tone, so it's
    // a grid of samples rather than a row that should widen its container.
    name: 'Tones',
    render: () => (
      <div className="flex flex-wrap items-center gap-4">
        {TONE_NAMES.map((tone) => (
          <Spinner key={tone} tone={tone} />
        ))}
      </div>
    ),
  },
];

export const playground = definePlayground({
  docs: {
    summary:
      'The one busy indicator. It is a composition over `Icon` — the same `circle-half` glyph with `animate="spin"` — so it inherits the icon system’s sizing and tones rather than inventing its own.',
  },
  controls: {
    size: number(14, {
      min: 10,
      max: 40,
      description: 'Edge length in pixels. Match it to the text or control the spinner sits in.',
    }),
    tone: select(TONE_NAMES, {
      initial: 'primary',
      type: 'Tone',
      description:
        'Leave unset inside a button so the spinner takes the button’s own colour; set it when the spinner stands alone.',
    }),
  },
  render: (v) => <Spinner size={v.size} tone={v.tone} />,
});
