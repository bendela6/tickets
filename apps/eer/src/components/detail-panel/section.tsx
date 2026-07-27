import { cn } from '@tickets/ui';

export function Section({ title, count }: { title: string; count?: number }) {
  return (
    <div
      className={cn(
        'mb-2 mt-4 flex items-baseline gap-2',
        'text-2xs font-semibold uppercase tracking-widest text-gray-400',
      )}
    >
      <span>{title}</span>
      {count != null && <span className="font-mono text-gray-400/80">{count}</span>}
    </div>
  );
}
