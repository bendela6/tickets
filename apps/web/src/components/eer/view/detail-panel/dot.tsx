import { cn } from '@tickets/ui';

export function Dot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      className={cn('inline-block h-8 w-8 shrink-0 rounded-full bg-(--dot-color)', className)}
      style={{ '--dot-color': color }}
    />
  );
}
