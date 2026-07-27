import { boolean, definePlayground, text } from '@tickets/ui';
import { Textarea } from './textarea';

export const meta = { title: 'Textarea', group: 'Form controls', size: 'md' };

export const states = [
  { name: 'with placeholder', render: () => <Textarea placeholder="Steps to reproduce…" /> },
];

export const playground = definePlayground({
  controls: {
    placeholder: text('Steps to reproduce…'),
    invalid: boolean(),
    disabled: boolean(),
  },
  render: (v) => <div className="w-72"><Textarea {...v} /></div>,
});
