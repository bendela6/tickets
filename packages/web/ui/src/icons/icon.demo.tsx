import { definePlayground, number, select } from '../gallery';
import { TONE_NAMES } from '../tones';
import { Icon } from './icon';
import { ICON_NAMES } from './registry';

export const meta = {
  title: 'Icon',
  group: 'Foundation',
  order: 2,
  size: 'full',
  // The glyphs themselves are the interesting half, so the Implementation tab
  // offers both files rather than only the wrapper component.
  impl: ['./icon.tsx', './registry.tsx'],
};

export const states = [
  {
    name: 'Registry',
    render: () => (
      <div className="flex flex-wrap gap-4">
        {ICON_NAMES.map((name) => (
          <div key={name} className="flex w-20 flex-col items-center gap-1.5 text-ink-2">
            <Icon name={name} size={16} />
            <span className="font-mono text-[10px] text-ink-3">{name}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    name: 'Composed',
    render: () => (
      <div className="flex items-center gap-4">
        <Icon name="circle-half" tone="blue" animate="spin" />
        <Icon name="diamond" tone="orange" animate="pulse" />
        <Icon name="circle-check" tone="green" />
        <Icon name="triangle-alert" tone="warning" size={20} />
      </div>
    ),
  },
];

export const playground = definePlayground({
  controls: {
    name: select(ICON_NAMES, { initial: 'circle-half' }),
    size: number(14, { min: 10, max: 32 }),
    tone: select(TONE_NAMES, { allowNone: true }),
    animate: select(['spin', 'pulse'] as const, { allowNone: true }),
  },
  render: (v) => <Icon name={v.name} size={v.size} tone={v.tone} animate={v.animate} />,
});
