import { definePlayground, select, text } from '../../gallery';
import { TONE_NAMES } from '../../style';
import { Avatar } from './avatar';

const SIZES = ['xs', 'sm', 'md', 'lg', 'xl'] as const;

export const meta = { title: 'Avatar', group: 'Components', order: 5, size: 'sm' };

export const states = [
  {
    name: 'human',
    render: () => <Avatar name="Mara K." kind="human" />,
  },
  {
    name: 'agent',
    render: () => <Avatar name="claude-worker" kind="agent" />,
  },
  {
    name: 'sizes',
    render: () => (
      <div className="flex items-center gap-2">
        {SIZES.map((size) => (
          <Avatar key={size} name="Mara K." kind="human" size={size} />
        ))}
      </div>
    ),
  },
  {
    name: 'tone',
    render: () => (
      <div className="flex items-center gap-2">
        {(['success', 'warning', 'danger', 'purple'] as const).map((tone) => (
          <Avatar key={tone} name="Mara K." kind="human" size="md" tone={tone} />
        ))}
      </div>
    ),
  },
];

export const playground = definePlayground({
  docs: {
    summary:
      '`kind` is the shape and the typeface — a human is a round slot in sans, an agent a square token in mono. `tone` is only the colour, defaulting to cyan for humans and the accent for agents.',
  },
  controls: {
    name: text('Mara K.'),
    kind: select(['human', 'agent'] as const, { initial: 'human', type: 'AvatarKind' }),
    size: select(SIZES, {
      allowNone: true,
      type: 'AvatarSize',
      description: '16, 18, 22, 28 and 36px — the avatar ladder, not the control ladder.',
    }),
    tone: select([...TONE_NAMES], { allowNone: true, type: 'Tone' }),
  },
  render: ({ name, kind, size, tone }) => <Avatar name={name} kind={kind} size={size} tone={tone} />,
});
