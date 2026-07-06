import { cn } from './cn';

type TicketKeyProps = { prefix: string; number: number; muted?: boolean; className?: string };

export function TicketKey({ prefix, number, muted, className }: TicketKeyProps) {
  return (
    <span className={cn('font-mono text-meta font-medium', muted ? 'text-ink-3' : 'text-ink-2', className)}>
      {prefix}-{number}
    </span>
  );
}
