import { definePlayground, select, boolean, text } from './gallery';
import { TONE_NAMES } from './tones';
import { ICON_NAMES } from './icons/registry';
import { Pill } from './pill';
import { Icon } from './icons/icon';

export const meta = { title: 'Pill', group: 'Display' };

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
  controls: {
    label: text('Pill'),
    tone: select(TONE_NAMES, { initial: 'neutral' }),
    emphasis: select(['subtle', 'solid', 'outline', 'text'] as const, { initial: 'subtle' }),
    icon: select(ICON_NAMES, { allowNone: true }),
    shape: select(['md', 'full'] as const, { initial: 'md' }),
    strikethrough: boolean(false),
    disabled: boolean(false),
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
