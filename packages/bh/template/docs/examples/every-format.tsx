import type { TemplateField, TemplateNode } from '@bh/template';
import { Template } from '@bh/ui';

const FIELDS: TemplateField[] = [
  { key: 'amount', label: 'Amount', type: { kind: 'number' } },
  { key: 'share', label: 'Share', type: { kind: 'number' } },
  { key: 'size', label: 'Size', type: { kind: 'number' } },
  { key: 'took', label: 'Took', type: { kind: 'number' } },
  { key: 'price', label: 'Price', type: { kind: 'number' } },
  { key: 'day', label: 'Day', type: { kind: 'date' } },
  { key: 'at', label: 'At', type: { kind: 'datetime' } },
  { key: 'title', label: 'Title', type: { kind: 'text' } },
  { key: 'notes', label: 'Notes', type: { kind: 'markdown' } },
  { key: 'body', label: 'Body', type: { kind: 'richtext' } },
];

const RECORD = {
  amount: 12400,
  share: 0.427,
  size: 13002342,
  took: 125,
  price: 12.5,
  day: '2026-07-13',
  at: '2026-07-13T09:05:00Z',
  title: 'As it is',
  notes: 'Read **the guide** first',
  body: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Open at nine."}]}]}',
};

const TEMPLATE: TemplateNode = {
  layout: 'grid',
  options: { columns: 2, gap: 3 },
  nodes: [
    { value: 'number', options: { mono: true, tone: 'gray' } },
    { field: 'amount', format: 'number' },
    { value: 'number, compact', options: { mono: true, tone: 'gray' } },
    { field: 'amount', format: { name: 'number', options: { notation: 'compact' } } },
    { value: 'percent', options: { mono: true, tone: 'gray' } },
    { field: 'share', format: 'percent' },
    { value: 'bytes', options: { mono: true, tone: 'gray' } },
    { field: 'size', format: 'bytes' },
    { value: 'bytes, per second', options: { mono: true, tone: 'gray' } },
    { field: 'size', format: { name: 'bytes', options: { per: 's' } } },
    { value: 'duration', options: { mono: true, tone: 'gray' } },
    { field: 'took', format: 'duration' },
    { value: 'money', options: { mono: true, tone: 'gray' } },
    { field: 'price', format: { name: 'money', options: { currency: 'EUR' } } },
    { value: 'date', options: { mono: true, tone: 'gray' } },
    { field: 'day', format: 'date' },
    { value: 'datetime', options: { mono: true, tone: 'gray' } },
    { field: 'at', format: 'datetime' },
    { value: 'relative', options: { mono: true, tone: 'gray' } },
    { field: 'at', format: 'relative' },
    { value: 'plain', options: { mono: true, tone: 'gray' } },
    { field: 'title', format: 'plain' },
    { value: 'markdown', options: { mono: true, tone: 'gray' } },
    { field: 'notes', format: 'markdown' },
    { value: 'rich', options: { mono: true, tone: 'gray' } },
    { field: 'body', format: 'rich' },
  ],
};

export function EveryFormat() {
  return (
    <Template
      template={TEMPLATE}
      record={RECORD}
      fields={FIELDS}
      context={{ timeZone: 'UTC', now: new Date('2026-07-13T12:00:00Z') }}
    />
  );
}
