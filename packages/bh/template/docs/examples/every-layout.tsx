import type { TemplateField, TemplateNode } from '@bh/template';
import { Template } from '@bh/ui';

const FIELDS: TemplateField[] = [
  { key: 'title', label: 'Title', type: { kind: 'text' } },
  {
    key: 'status',
    label: 'Status',
    type: {
      kind: 'option',
      settings: { options: [{ value: 'open', label: 'Open', color: 'green' }] },
    },
  },
  { key: 'seats', label: 'Seats', type: { kind: 'number' } },
  { key: 'floor', label: 'Floor', type: { kind: 'number' } },
  { key: 'booked', label: 'Booked', type: { kind: 'date' } },
  { key: 'tags', label: 'Tags', type: { kind: 'text', many: true } },
];

const RECORD = {
  title: 'Repaint the hall',
  status: 'open',
  seats: 40,
  floor: 2,
  booked: '2026-07-13',
  tags: ['paint', 'walls', 'floor', 'stairs', 'doors'],
};

const TEMPLATE: TemplateNode = {
  layout: 'stack',
  options: { gap: 3 },
  nodes: [
    {
      layout: 'row',
      options: { justify: 'between', gap: 2 },
      nodes: [{ field: 'title', options: { weight: 600 } }, { field: 'status' }],
    },
    {
      layout: 'grid',
      options: { columns: 3, gap: 2 },
      nodes: [{ text: '{seats} seats' }, { text: 'Floor {floor}' }, { field: 'booked' }],
    },
    {
      layout: 'repeat',
      options: { field: 'tags', max: 3, gap: 1 },
      nodes: [{ field: 'tags', renderer: 'pill' }],
    },
  ],
};

export function EveryLayout() {
  return <Template template={TEMPLATE} record={RECORD} fields={FIELDS} />;
}
