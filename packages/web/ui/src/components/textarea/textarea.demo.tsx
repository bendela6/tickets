import { boolean, definePlayground, select, text } from '../../gallery';
import { TONE_NAMES } from '../../style';
import { Textarea } from './textarea';

export const meta = { title: 'Textarea', group: 'Components', size: 'md' };

export const states = [
  { name: 'with placeholder', render: () => <Textarea placeholder="Steps to reproduce…" /> },
  { name: 'sm', render: () => <Textarea size="sm" placeholder="Two lines" /> },
  { name: 'lg', render: () => <Textarea size="lg" placeholder="Four lines" /> },
  { name: 'invalid', render: () => <Textarea invalid placeholder="Required" /> },
];

export const playground = definePlayground({
  controls: {
    placeholder: text('Steps to reproduce…'),
    size: select(['sm', 'md', 'lg'], { allowNone: true }),
    tone: select([...TONE_NAMES], { allowNone: true }),
    invalid: boolean(),
    disabled: boolean(),
  },
  render: (v) => <div className="w-72"><Textarea {...v} /></div>,
});
