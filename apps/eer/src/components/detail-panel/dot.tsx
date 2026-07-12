import { cn } from '../../ui/cn';
import { runtimeStyle } from '../../ui/runtime-style';

export function Dot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      className={cn('inline-block h-2 w-2 shrink-0 rounded-full bg-(--dot-color)', className)}
      style={runtimeStyle({ '--dot-color': color })}
    />
  );
}
