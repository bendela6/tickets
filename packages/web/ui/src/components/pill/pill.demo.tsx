import { definePlayground, select, boolean, text } from '../../gallery';
import { TONE_NAMES } from '../../style/tones';
import { ICON_NAMES } from '../icon/registry';
import { Pill } from './pill';
import { Icon } from '../icon';

export const meta = { title: 'Pill', group: 'Display', size: 'sm' };

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
    name: 'Emphases',
    render: () => (
      <div className="flex flex-wrap gap-3">
        {(['subtle', 'solid', 'outline', 'text'] as const).map((emphasis) => (
          <Pill key={emphasis} label={emphasis} tone="green" emphasis={emphasis} />
        ))}
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
        <Pill label="tag" shape="full" trailing={<span>5</span>} />
      </div>
    ),
  },
];

export const playground = definePlayground({
  docs: {
    summary:
      'A compact label for exactly one fact — a status, a type, a count. `tone` carries the meaning and `emphasis` carries the weight; pick the pair that lets the pill sit as quietly as its row allows.',
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
    emphasis: select(['subtle', 'solid', 'outline', 'text'] as const, {
      initial: 'subtle',
      type: 'ToneEmphasis',
      description:
        'How loudly the tone reads. `subtle` is the default and the right pick inside lists; `solid` is for the one pill that has to win the row.',
    }),
    icon: select(ICON_NAMES, {
      allowNone: true,
      type: 'IconName | ReactElement',
      description:
        'Leading glyph from the icon registry, inheriting the pill’s own colour. Pass an element instead when the mark is not a registry icon.',
    }),
    shape: select(['md', 'full'] as const, {
      initial: 'md',
      description:
        'Corner radius. `md` lines up with the surrounding controls; `full` reads as a tag or a count.',
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
      emphasis={v.emphasis}
      icon={v.icon}
      shape={v.shape}
      strikethrough={v.strikethrough}
      disabled={v.disabled}
    />
  ),
});
