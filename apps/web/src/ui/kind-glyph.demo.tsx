import { KindGlyph, type StatusKind } from './kind-glyph';

const KINDS: { kind: StatusKind; label: string; class: string }[] = [
  { kind: 'todo', label: 'Backlog', class: 'text-kind-todo' },
  { kind: 'active', label: 'In progress', class: 'text-kind-active' },
  { kind: 'blocked', label: 'Blocked', class: 'text-kind-blocked' },
  { kind: 'done', label: 'Shipped', class: 'text-kind-done' },
  { kind: 'dropped', label: "Won't do", class: 'text-kind-dropped' },
];

export const meta = { title: 'Kind Glyph', group: 'Display', order: 6 };

export const states = KINDS.map((entry) => ({
  name: entry.label.toLowerCase().replace(/ /g, '-'),
  render: () => (
    <span className={entry.class}>
      <KindGlyph kind={entry.kind} />
    </span>
  ),
}));
