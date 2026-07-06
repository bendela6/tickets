import { cn } from './cn';

export function TypeBadge({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-ctrl border border-hairline px-1.5 py-px font-sans text-meta text-ink-2',
        className,
      )}
    >
      {label}
    </span>
  );
}
