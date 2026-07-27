import { boolean, definePlayground, select, text } from '../../gallery';
import { TONE_NAMES } from '../../style';
import { Input } from './input';

export const meta = { title: 'Input', group: 'Components', size: 'md' };

export const states = [
  { name: 'with placeholder', render: () => <Input placeholder="Ticket title…" /> },
  { name: 'sm', render: () => <Input size="sm" placeholder="Estimate" /> },
  { name: 'lg', render: () => <Input size="lg" placeholder="Title" /> },
  { name: 'invalid', render: () => <Input invalid placeholder="Key" /> },
  { name: 'disabled', render: () => <Input placeholder="Disabled" disabled /> },
  {
    name: 'tone',
    render: () => (
      <div className="flex flex-col gap-2">
        <Input tone="success" placeholder="focus me — green ring" />
        <Input tone="warning" placeholder="focus me — orange ring" />
      </div>
    ),
  },
];

export const playground = definePlayground({
  controls: {
    placeholder: text('Ticket title…'),
    size: select(['sm', 'md', 'lg'], { allowNone: true }),
    tone: select([...TONE_NAMES], { allowNone: true }),
    invalid: boolean(),
    disabled: boolean(),
  },
  render: (v) => <div className="w-56"><Input {...v} /></div>,
});
