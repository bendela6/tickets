import { definePlayground, select, boolean, text } from '../../gallery';
import { TONE_NAMES } from '../../style/tones';
import { ICON_NAMES } from '../icon/registry';
import { Pill } from './pill';
import { Icon } from '../icon';

export const meta = { title: 'Pill', group: 'Components', size: 'sm' };

export const states = [
  {
    name: 'Tones',
    render: () => (
      <div className="flex flex-wrap gap-3">
        {TONE_NAMES.map((tone) => (
          <Pill key={tone} label={tone} tone={tone} />
        ))}
      </div>
    ),
  },
  {
    name: 'Variants',
    render: () => (
      <div className="flex flex-wrap gap-3">
        {(['subtle', 'solid', 'outline', 'text', 'tint'] as const).map((variant) => (
          <Pill key={variant} label={variant} tone="green" variant={variant} />
        ))}
      </div>
    ),
  },
  {
    name: 'Sizes',
    render: () => (
      <div className="flex flex-wrap items-center gap-3">
        {(['xs', 'sm', 'md', 'lg'] as const).map((size) => (
          <Pill key={size} label={size} tone="blue" size={size} icon="circle" />
        ))}
      </div>
    ),
  },
  {
    name: 'Chevron',
    render: () => (
      <div className="flex flex-wrap gap-3">
        <Pill label="Assignee" chevron onClick={() => {}} />
        <Pill label="Status" tone="blue" chevron onClick={() => {}} />
      </div>
    ),
  },
  {
    name: 'Shapes',
    render: () => (
      <div className="flex flex-wrap gap-3">
        <Pill label="square" shape="square" tone="purple" />
        <Pill label="round" shape="round" tone="purple" />
      </div>
    ),
  },
  {
    name: 'With icons',
    render: () => (
      <div className="flex flex-wrap gap-3">
        <Pill label="circle" icon="circle" />
        <Pill label="spinning" icon={<Icon name="circle-half" animate="spin" />} />
        <Pill label="diamond" icon="diamond" />
        <Pill label="check" icon="circle-check" />
      </div>
    ),
  },
  {
    name: 'Toggle',
    render: () => (
      <div className="flex flex-wrap gap-3">
        <Pill label="pressed" onClick={() => {}} pressed />
        <Pill label="unpressed" onClick={() => {}} />
        <Pill label="disabled" onClick={() => {}} disabled />
      </div>
    ),
  },
  {
    name: 'Trailing + strikethrough',
    render: () => (
      <div className="flex flex-wrap gap-3">
        <Pill label="done" strikethrough trailing={<span>3</span>} />
        <Pill label="tag" shape="round" trailing={<span>5</span>} />
      </div>
    ),
  },
];

export const playground = definePlayground({
  docs: {
    summary:
      'A compact label for exactly one fact — a status, a type, a count. `tone` carries the meaning and `variant` carries the weight; pick the pair that lets the pill sit as quietly as its row allows.',
  },
  controls: {
    label: text('Pill', {
      type: 'ReactNode',
      required: true,
      description:
        'The pill text. Keep it to a word or two — pills sit inside dense rows and never wrap.',
    }),
    tone: select(TONE_NAMES, {
      initial: 'neutral',
      type: 'Tone',
      description:
        'Semantic colour. The six semantic names carry meaning across themes; the eleven hue names are for user-chosen colours, where the hue itself is the label.',
    }),
    variant: select(['subtle', 'solid', 'outline', 'text'] as const, {
      initial: 'subtle',
      type: 'PillVariant',
      description:
        'How loudly the tone reads. `subtle` is the default and the right pick inside lists; `solid` is for the one pill that has to win the row.',
    }),
    size: select(['sm', 'md', 'lg'] as const, {
      initial: 'md',
      type: 'PillSize',
      description:
        'Height of the pill — 18, 22 and 28px. `md` sits inside a table row; `lg` is for a pill that stands alone.',
    }),
    icon: select(ICON_NAMES, {
      allowNone: true,
      type: 'IconName | ReactElement',
      description:
        'Leading glyph from the icon registry, inheriting the pill’s own colour. Pass an element instead when the mark is not a registry icon.',
    }),
    shape: select(['square', 'round'] as const, {
      initial: 'square',
      type: 'PillShape',
      description:
        'Corner treatment. `square` lines up with the surrounding controls; `round` reads as a tag or a count.',
    }),
    chevron: boolean(false, {
      description: 'Trailing chevron, for a pill that opens a menu or popover.',
    }),
    strikethrough: boolean(false, {
      description:
        'Strikes the label for a value that no longer applies — a dropped status, a removed tag.',
    }),
    disabled: boolean(false, {
      description:
        'Only meaningful on a toggle pill (one with `onClick`). Drops it out of the tab order and mutes the tone.',
    }),
  },
  render: (v) => (
    <Pill
      label={v.label}
      tone={v.tone}
      variant={v.variant}
      size={v.size}
      icon={v.icon}
      shape={v.shape}
      chevron={v.chevron}
      strikethrough={v.strikethrough}
      disabled={v.disabled}
    />
  ),
});
