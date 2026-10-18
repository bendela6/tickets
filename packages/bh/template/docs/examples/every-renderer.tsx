import type { TemplateField, TemplateNode } from '@bh/template';
import { Template } from '@bh/ui';

const FIELDS: TemplateField[] = [
  { key: 'title', label: 'Title', type: { kind: 'text' } },
  { key: 'code', label: 'Code', type: { kind: 'text' } },
  {
    key: 'status',
    label: 'Status',
    type: {
      kind: 'option',
      settings: { options: [{ value: 'open', label: 'Open', color: 'green' }] },
    },
  },
  { key: 'booked', label: 'Booked', type: { kind: 'date' } },
  { key: 'seats', label: 'Seats', type: { kind: 'number' } },
  { key: 'owner', label: 'Owner', type: { kind: 'ref', settings: { of: 'people' } } },
  { key: 'icon', label: 'Icon', type: { kind: 'text' } },
  { key: 'done', label: 'Done', type: { kind: 'number' } },
  { key: 'share', label: 'Share', type: { kind: 'number' }, format: 'percent' },
  { key: 'change', label: 'Change', type: { kind: 'number' }, format: 'percent' },
  { key: 'paid', label: 'Paid', type: { kind: 'boolean' } },
  { key: 'extra', label: 'Extra', type: { kind: 'json' } },
];

const RECORD = {
  title: 'Repaint the hall',
  code: 'R-12',
  status: 'open',
  booked: '2026-07-13',
  seats: 1234.5,
  owner: 7,
  icon: 'calendar',
  done: 64,
  share: 0.72,
  change: 0.12,
  paid: true,
  extra: { seats: 4 },
};

const TEMPLATE: TemplateNode = {
  layout: 'grid',
  options: { columns: 2, gap: 3, align: 'center' },
  nodes: [
    { value: 'text', options: { mono: true, tone: 'gray' } },
    { field: 'title', renderer: 'text' },
    { value: 'link', options: { mono: true, tone: 'gray' } },
    { field: 'code', renderer: { name: 'link', options: { to: '/rooms/{code}' } } },
    { value: 'pill', options: { mono: true, tone: 'gray' } },
    { field: 'status', renderer: 'pill' },
    { value: 'date', options: { mono: true, tone: 'gray' } },
    { field: 'booked', renderer: 'date' },
    { value: 'number', options: { mono: true, tone: 'gray' } },
    { field: 'seats', renderer: 'number' },
    { value: 'avatar', options: { mono: true, tone: 'gray' } },
    { field: 'owner', renderer: 'avatar' },
    { value: 'user', options: { mono: true, tone: 'gray' } },
    { field: 'owner', renderer: 'user' },
    { value: 'icon', options: { mono: true, tone: 'gray' } },
    { field: 'icon', renderer: 'icon' },
    { value: 'progress', options: { mono: true, tone: 'gray' } },
    { field: 'done', renderer: 'progress' },
    { value: 'meter', options: { mono: true, tone: 'gray' } },
    { field: 'share', renderer: 'meter' },
    { value: 'trend', options: { mono: true, tone: 'gray' } },
    { field: 'change', renderer: 'trend' },
    { value: 'check', options: { mono: true, tone: 'gray' } },
    { field: 'paid', renderer: 'check' },
    { value: 'code', options: { mono: true, tone: 'gray' } },
    { field: 'extra', renderer: 'code' },
  ],
};

export function EveryRenderer() {
  return (
    <Template
      template={TEMPLATE}
      record={RECORD}
      fields={FIELDS}
      refOf={() => ({ title: 'Ana Lee' })}
    />
  );
}
