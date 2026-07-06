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
        'inline-flex h-5.5 items-center gap-1.5 rounded-md px-2.25 font-sans text-meta font-medium',
        kindClasses[kind],
        className,
      )}
    >
      <KindGlyph kind={kind} />
      {kind === 'dropped' ? <span className="line-through">{label}</span> : label}
    </span>
  );
}
