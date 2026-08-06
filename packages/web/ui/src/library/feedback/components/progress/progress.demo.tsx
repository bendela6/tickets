import { definePlayground, number, select, text } from '../../../../docs/gallery';
import { TONE_NAMES } from '../../../../style/tones';
import { Progress } from './progress';

const SIZES = ['sm', 'md', 'lg'] as const;

export const meta = { title: 'Progress', group: 'Components', size: 'md' };

export const states = [
  { name: 'empty', render: () => <Progress value={0} className="w-160" /> },
  { name: 'part way', render: () => <Progress value={42} className="w-160" /> },
  { name: 'complete', render: () => <Progress value={100} tone="success" className="w-160" /> },
  {
    name: 'sizes',
    render: () => (
      <div className="flex flex-col gap-12">
        {SIZES.map((size) => (
          <Progress key={size} value={62} size={size} className="w-160" />
        ))}
      </div>
    ),
  },
  {
    name: 'tones',
    render: () => (
      <div className="flex flex-col gap-12">
        {(['primary', 'success', 'warning', 'danger'] as const).map((tone) => (
          <Progress key={tone} value={78} tone={tone} className="w-160" />
        ))}
      </div>
    ),
  },
  {
    name: 'labelled',
    render: () => (
      <div className="flex flex-col gap-12">
        <Progress value={40} label="2/5" className="w-192" />
        <Progress value={90} tone="danger" trailing="90%" className="w-192" />
      </div>
    ),
  },
  {
    // Out-of-range values are clamped rather than overflowing the track.
    name: 'clamped',
    render: () => (
      <div className="flex flex-col gap-12">
        <Progress value={-20} className="w-160" />
        <Progress value={140} className="w-160" />
      </div>
    ),
  },
];

export const playground = definePlayground({
  docs: {
    summary:
      'A percentage, drawn. It has no idea what it is measuring — a caller with a token budget or a spend cap converts to a percent and picks the tone itself, because only that caller knows what "nearly out" means for its own quantity.',
  },
  controls: {
    value: number(62, { min: 0, max: 100, step: 1, description: 'Percent complete, 0–100.' }),
    tone: select(TONE_NAMES, { allowNone: true, type: 'Tone' }),
    size: select(SIZES, { allowNone: true, type: 'ProgressSize' }),
    label: text('', { placeholder: 'leading figure…' }),
    trailing: text('', { placeholder: 'trailing figure…' }),
  },
  render: (v) => (
    <Progress
      value={v.value}
      tone={v.tone}
      size={v.size}
      label={v.label || undefined}
      trailing={v.trailing || undefined}
      className="w-192"
    />
  ),
});
