import { definePlayground, select } from '../../../../docs/gallery';
import { TONE_NAMES } from '../../../../style/tones';
import { Icon } from './icon';
import { ICON_NAMES } from './registry';

export const meta = {
  title: 'Icon',
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
      <div className="flex flex-wrap gap-16">
        {ICON_NAMES.map((name) => (
          <div key={name} className="flex w-80 flex-col items-center gap-6 text-gray-11">
            <Icon name={name} size="lg" />
            <span className="font-mono text-10 text-gray-9">{name}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    name: 'Composed',
    render: () => (
      <div className="flex items-center gap-16">
        <Icon name="circle-half" tone="blue" animate="spin" />
        <Icon name="diamond" tone="orange" animate="pulse" />
        <Icon name="circle-check" tone="green" />
        <Icon name="triangle-alert" tone="warning" size="xl" />
      </div>
    ),
  },
];

export const playground = definePlayground({
  docs: {
    summary:
      'Every glyph in the product comes from one registry, and every glyph is colourless — an icon draws in `currentColor` until a tone says otherwise. Adding a glyph means adding one entry to `registry.tsx`; nothing else changes.',
  },
  controls: {
    name: select(ICON_NAMES, {
      initial: 'circle-half',
      type: 'IconName',
      required: true,
      description:
        'Registry key. Names describe the shape (`circle-half`), never the use (`kind-active`), so one glyph can serve a status in one screen and a spinner in another.',
    }),
    size: select(['2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl'] as const, {
      initial: 'md',
      type: 'IconSize',
      description:
        'Rung on the glyph ladder — 8/10/12/14/16/20/28px, applied to both width and height. Icons are sized to the text they sit beside, so pick the rung that matches the label, not the container.',
    }),
    tone: select(TONE_NAMES, {
      allowNone: true,
      type: 'Tone',
      description:
        'Draws the glyph in a tone instead of inheriting. Leave it unset inside buttons and pills so the icon follows its container’s colour.',
    }),
    animate: select(['spin', 'pulse'] as const, {
      allowNone: true,
      description:
        'Motion is opt-in — no glyph animates by default. `spin` is for work in flight, `pulse` for something awaiting attention.',
    }),
  },
  render: (v) => <Icon name={v.name} size={v.size} tone={v.tone} animate={v.animate} />,
});
