import { Prose } from '@bh/markdown';

// What the rich text editor stores: its document, as JSON.
const STORED = JSON.stringify({
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Before you go' }] },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Ask ' },
        { type: 'mention', attrs: { id: 2, label: 'Rui Lima' } },
        { type: 'text', text: ' for the keys, and ' },
        { type: 'text', text: 'water the ferns', marks: [{ type: 'bold' }] },
        { type: 'text', text: '.' },
      ],
    },
    {
      type: 'taskList',
      content: [
        {
          type: 'taskItem',
          attrs: { checked: true },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Close the windows' }] }],
        },
        {
          type: 'taskItem',
          attrs: { checked: false },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Empty the fridge' }] }],
        },
      ],
    },
    {
      type: 'callout',
      attrs: { kind: 'warning' },
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'The back door sticks: lift it.' }] },
      ],
    },
  ],
});

export function AStoredDocument() {
  return <Prose>{STORED}</Prose>;
}
