import { cn } from '@tickets/ui';

export type SignalLevel = 'error' | 'warning' | 'info';

// Shape-coded per docs/design/SigGallery.dc.html "LEVEL DOTS — SHAPE + COLOR":
// error is a filled danger circle, warning a filled warn (opt-orange)
// diamond, info an open accent (opt-blue) circle. Shape carries the
// meaning so level never rides on color alone.
const SHAPE_CLASSES: Record<SignalLevel, string> = {
  error: 'size-9 rounded-full bg-red-9',
  warning: 'size-8 rotate-45 rounded-none bg-orange-9',
  info: 'size-8 rounded-full border-2 border-blue-9 bg-transparent box-border',
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
