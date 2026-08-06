import { definePlayground, select, text } from '../../gallery';
import { TONE_NAMES } from '../../style';
import { Avatar } from './avatar';

const SIZES = ['xs', 'sm', 'md', 'lg', 'xl'] as const;

export const meta = { title: 'Avatar', group: 'Components', order: 5, size: 'sm' };

export const states = [
  { name: 'round', render: () => <Avatar name="Mara K." /> },
  { name: 'square', render: () => <Avatar name="Nils P." shape="square" /> },
  { name: 'mono', render: () => <Avatar name="claude worker" shape="square" font="mono" /> },
  {
    name: 'sizes',
    render: () => (
      <div className="flex items-center gap-8">
        {SIZES.map((size) => (
          <Avatar key={size} name="Mara K." size={size} />
        ))}
      </div>
    ),
  },
  {
    name: 'tones',
    render: () => (
      <div className="flex items-center gap-8">
        {(['cyan', 'success', 'warning', 'danger', 'purple'] as const).map((tone) => (
          <Avatar key={tone} name="Mara K." size="md" tone={tone} />
        ))}
      </div>
    ),
  },
];

export const playground = definePlayground({
  docs: {
    summary:
      'Initials in a coloured slot. Shape, typeface and tone are independent axes — the component has no idea whether it is standing for a person, a bot or a build. An app assigns that meaning at the call site.',
  },
  controls: {
    name: text('Mara K.'),
    shape: select(['round', 'square'] as const, { initial: 'round', type: 'AvatarShape' }),
    font: select(['sans', 'mono'] as const, {
      initial: 'sans',
      type: 'AvatarFont',
      description: 'Mono reads as an identifier, matching ticket keys and project prefixes.',
    }),
    size: select(SIZES, {
      allowNone: true,
      type: 'AvatarSize',
      description: '16, 18, 22, 28 and 36px — the avatar ladder, not the control ladder.',
    }),
    tone: select([...TONE_NAMES], { allowNone: true, type: 'Tone' }),
  },
  render: ({ name, shape, font, size, tone }) => (
    <Avatar name={name} shape={shape} font={font} size={size} tone={tone} />
  ),
});
