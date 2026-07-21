import { cn } from '../../ui/cn';

export type SignalLevel = 'error' | 'warning' | 'info';

// Shape-coded per docs/design/SigGallery.dc.html "LEVEL DOTS — SHAPE + COLOR":
// error is a filled danger circle, warning a filled warn (kind-blocked)
// diamond, info an open accent (kind-active) circle. Shape carries the
// meaning so level never rides on color alone.
const SHAPE_CLASSES: Record<SignalLevel, string> = {
  error: 'size-2.25 rounded-full bg-danger',
  warning: 'size-2 rotate-45 rounded-[1px] bg-kind-blocked',
  info: 'size-2 rounded-full border-[1.5px] border-kind-active bg-transparent box-border',
};

export function LevelDot({ level, className }: { level: SignalLevel; className?: string }) {
  return (
    <span
      role="img"
      aria-label={level}
      className={cn('inline-block shrink-0', SHAPE_CLASSES[level], className)}
    />
  );
}
