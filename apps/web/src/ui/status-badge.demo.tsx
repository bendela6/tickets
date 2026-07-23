import { definePlayground, select, text } from '@tickets/ui/gallery';
import { StatusBadge } from './status-badge';
import type { StatusKind } from './kind-glyph';

const KINDS: { kind: StatusKind; label: string }[] = [
  { kind: 'todo', label: 'Backlog' },
  { kind: 'active', label: 'In progress' },
  { kind: 'blocked', label: 'Blocked' },
  { kind: 'done', label: 'Shipped' },
  { kind: 'dropped', label: "Won't do" },
];

export const meta = { title: 'Status Badge', group: 'Display', order: 1 };

export const states = KINDS.map((entry) => ({
  name: entry.label.toLowerCase().replace(/ /g, '-'),
  render: () => <StatusBadge kind={entry.kind} label={entry.label} />,
}));

export const playground = definePlayground({
  controls: {
    kind: select(['todo', 'active', 'blocked', 'done', 'dropped'] as const, { initial: 'todo' }),
    label: text('In progress'),
  },
  render: ({ kind, label }) => <StatusBadge kind={kind} label={label} />,
});
