import { boolean, definePlayground, select, text } from '../../gallery';
import { TONE_NAMES } from '../../style';
import { Input } from './input';

export const meta = { title: 'Input', group: 'Components', size: 'md' };

export const states = [
  { name: 'with placeholder', render: () => <Input placeholder="Ticket title…" /> },
  { name: 'sm', render: () => <Input size="sm" placeholder="Estimate" /> },
  { name: 'lg', render: () => <Input size="lg" placeholder="Title" /> },
  { name: 'tone danger', render: () => <Input tone="danger" placeholder="Key" /> },
  { name: 'disabled', render: () => <Input placeholder="Disabled" disabled /> },
  {
    name: 'tone',
    render: () => (
      <div className="flex flex-col gap-8">
        <Input tone="success" placeholder="validated" />
        <Input tone="warning" placeholder="needs review" />
      </div>
    ),
  },
];

export const playground = definePlayground({
  controls: {
    placeholder: text('Ticket title…'),
    size: select(['sm', 'md', 'lg'], { allowNone: true }),
    tone: select([...TONE_NAMES], { allowNone: true }),
    disabled: boolean(),
  },
  render: (v) => <div className="w-224"><Input {...v} /></div>,
});
