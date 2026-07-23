import { Avatar } from './avatar';

export const meta = { title: 'Avatar', group: 'Display', order: 5 };

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
