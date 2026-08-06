import { cn } from '../../../../style';

export interface DotProps {
  /**
   * A raw CSS colour — `var(--color-blue-9)`, a `color-mix()` result, a hex.
   * NOT a tone name: this component exists precisely for colours computed at
   * runtime, which a token name cannot express.
   */
  color?: string;
  /** Ring instead of fill, for an "off" state. */
  hollow?: boolean;
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
        hollow ? 'border-1 border-gray-8' : 'bg-(--dot-color)',
        className,
      )}
      style={hollow ? undefined : { '--dot-color': color ?? 'var(--color-gray-9)' }}
    />
  );
}
