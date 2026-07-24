import { definePlayground, text } from '@tickets/ui/gallery';
import { TypeBadge } from './type-badge';

const TYPES = ['Task', 'Bug', 'Subtask'];

export const meta = { title: 'Type Badge', group: 'Display', order: 3 };

export const states = TYPES.map((type) => ({
  name: type.toLowerCase(),
  render: () => <TypeBadge label={type} />,
}));

export const playground = definePlayground({
  controls: {
    label: text('Task'),
  },
  render: ({ label }) => <TypeBadge label={label} />,
});
