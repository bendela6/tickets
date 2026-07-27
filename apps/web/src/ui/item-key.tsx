import { cn } from '@tickets/ui';

type ItemKeyProps = { prefix: string; number: number; muted?: boolean; className?: string };

export function ItemKey({ prefix, number, muted, className }: ItemKeyProps) {
  return (
    <span
      className={cn(
        'font-mono text-meta font-medium',
        muted ? 'text-gray-9' : 'text-gray-12',
        className,
      )}
    >
      {prefix}-{number}
    </span>
  );
}
