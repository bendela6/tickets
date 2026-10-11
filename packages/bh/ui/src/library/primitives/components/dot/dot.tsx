import { cn } from '../../../../style';

export interface DotProps {
  /**
   * The fill, as a raw CSS colour (`var(--color-blue-9)`, a `color-mix()` result, a hex), gray when unset.
   *
   * NOT a tone name: this component exists precisely for colours computed at
   * runtime, which a token name cannot express.
   */
  color?: string;
  /** A gray ring in place of the fill, for an "off" state. */
  hollow?: boolean;
  /** Added to the dot's own classes. */
  className?: string;
}

/** An 8px disc. Decorative by construction — whatever it stands for is said
 *  by the text beside it, so it is hidden from assistive tech. */
export function Dot({ color, hollow, className }: DotProps) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block h-8 w-8 shrink-0 rounded-full',
        hollow ? 'border-gray-8 border-1' : 'bg-(--dot-color)',
        className,
      )}
      style={hollow ? undefined : { '--dot-color': color ?? 'var(--color-gray-9)' }}
    />
  );
}
