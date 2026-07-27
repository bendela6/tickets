import { definePlayground, select, text } from '../../gallery';
import { Avatar } from './avatar';

export const meta = { title: 'Avatar', group: 'Components', order: 5, size: 'sm' };

export const states = [
  {
    name: 'human sm',
    render: () => <Avatar name="Mara K." kind="human" />,
  },
  {
    name: 'human md',
    render: () => <Avatar name="Mara K." kind="human" size="md" />,
  },
  {
    name: 'agent sm',
    render: () => <Avatar name="claude-worker" kind="agent" />,
  },
  {
    name: 'agent md',
    render: () => <Avatar name="claude-worker" kind="agent" size="md" />,
  },
];

export const playground = definePlayground({
  controls: {
    name: text('Mara K.'),
    kind: select(['human', 'agent'] as const, { initial: 'human' }),
    size: select(['sm', 'md'], { allowNone: true }),
  },
  render: ({ name, kind, size }) => <Avatar name={name} kind={kind} size={size} />,
});
