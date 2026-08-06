import { definePlayground, select } from '../../../../docs/gallery';
import { TONE_NAMES } from '../../../../style/tones';
import { Spinner } from './spinner';

export const meta = { title: 'Spinner', size: 'md' };

export const states = [
  {
    name: 'Sizes',
    render: () => (
      <div className="flex items-center gap-16">
        <Spinner size="xs" tone="primary" />
        <Spinner size="md" tone="primary" />
        <Spinner size="xl" tone="primary" />
        <Spinner size="2xl" tone="primary" />
      </div>
    ),
  },
  {
    // Wraps like the Icon registry does: this enumerates every tone, so it's
    // a grid of samples rather than a row that should widen its container.
    name: 'Tones',
    render: () => (
      <div className="flex flex-wrap items-center gap-16">
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
    variant: select(['arc', 'dashed', 'pulse'] as const, { initial: 'arc', type: 'SpinnerVariant' }),
    size: select(['2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl'] as const, {
      initial: 'md',
      type: 'IconSize',
      description: 'Same ladder as Icon. Match it to the text or control the spinner sits in.',
    }),
    tone: select(TONE_NAMES, {
      initial: 'primary',
      type: 'Tone',
      description:
        'Leave unset inside a button so the spinner takes the button’s own colour; set it when the spinner stands alone.',
    }),
  },
  render: (v) => <Spinner variant={v.variant} size={v.size} tone={v.tone} />,
});
