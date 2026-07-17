import { cn } from './cn';

type ItemKeyProps = { prefix: string; number: number; muted?: boolean; className?: string };

export function ItemKey({ prefix, number, muted, className }: ItemKeyProps) {
  return (
    <span
      className={cn(
        'font-mono text-meta font-medium',
        muted ? 'text-ink-3' : 'text-ink',
        className,
      )}
    >
      {prefix}-{number}
    </span>
  );
}
