import { boolean, definePlayground, select, text } from '../../gallery';
import { Input } from './input';

export const meta = { title: 'Input', group: 'Components', size: 'md' };

export const states = [
  { name: 'with placeholder', render: () => <Input placeholder="Ticket title…" /> },
  { name: 'compact', render: () => <Input size="compact" placeholder="Estimate" /> },
  { name: 'disabled', render: () => <Input placeholder="Disabled" disabled /> },
];

export const playground = definePlayground({
  controls: {
    placeholder: text('Ticket title…'),
    size: select(['compact', 'regular'], { allowNone: true }),
    invalid: boolean(),
    disabled: boolean(),
  },
  render: (v) => <div className="w-56"><Input {...v} /></div>,
});
