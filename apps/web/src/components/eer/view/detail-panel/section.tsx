import { cn } from '@tickets/ui';

export function Section({ title, count }: { title: string; count?: number }) {
  return (
    <div
      className={cn(
        'mb-8 mt-16 flex items-baseline gap-8',
        'text-10 font-600 uppercase tracking-widest text-gray-11',
      )}
    >
      <span>{title}</span>
      {count != null && <span className="font-mono text-gray-11/80">{count}</span>}
    </div>
  );
}
