import { cn } from './cn';
import { KindGlyph, type StatusKind } from './kind-glyph';

const kindClasses: Record<StatusKind, string> = {
  todo: 'bg-kind-todo-subtle text-kind-todo',
  active: 'bg-kind-active-subtle text-kind-active',
  blocked: 'bg-kind-blocked-subtle text-kind-blocked',
  done: 'bg-kind-done-subtle text-kind-done',
  dropped: 'bg-kind-dropped-subtle text-kind-dropped',
};

export function StatusBadge({ kind, label, className }: { kind: StatusKind; label: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-ctrl px-2 py-0.5 font-sans text-meta font-medium',
        kindClasses[kind],
        className,
      )}
    >
      <KindGlyph kind={kind} />
      {kind === 'dropped' ? <span className="line-through">{label}</span> : label}
    </span>
  );
}
