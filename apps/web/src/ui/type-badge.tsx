import { cn } from '@tickets/ui/cn';

export function TypeBadge({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-5.5 items-center rounded-md border border-control px-2.25 font-sans text-meta font-medium text-ink-2',
        className,
      )}
    >
      {label}
    </span>
  );
}
