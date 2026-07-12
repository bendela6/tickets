import { cn } from '../../ui/cn';

export function Section({ title, count }: { title: string; count?: number }) {
  return (
    <div
      className={cn(
        'mb-1.5 mt-4 flex items-baseline gap-1.5',
        'text-2xs font-semibold uppercase tracking-widest text-gray-400',
      )}
    >
      <span>{title}</span>
      {count != null && <span className="font-mono text-gray-400/80">{count}</span>}
    </div>
  );
}
