import { cn } from '../../../../style/cn';
import { TONE_HUE, type Tone } from '../../../../style/tones';
import { registry, type IconName } from './registry';

/**
 * The glyph ladder, shared with Spinner. These are the sizes icons actually
 * came in before the axis existed — eleven distinct pixel values between 7 and
 * 20, which is not a scale — collapsed onto seven rungs. Nothing moved by more
 * than a pixel.
 *
 * The value lands on the SVG's width/height attributes rather than a Tailwind
 * class, so this ladder never reaches the generated safelist.
 */
export const ICON_SIZES = {
  '2xs': 8,
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
  '2xl': 28,
} as const;

export type IconSize = keyof typeof ICON_SIZES;

/** Draws one glyph from the icon registry, in the colour of the text around it unless given a `tone`. */
export function Icon({
  name,
  size = 'md',
  tone,
  animate,
  label,
  className,
}: {
  /** Which glyph: a key of the registry, named for its shape. */
  name: IconName;
  /** Width and height together, on the glyph ladder: 8, 10, 12, 14, 16, 20 and 28 pixels. */
  size?: IconSize;
  /** Draws the glyph in step 11 of a tone's scale. Unset, it takes the colour of the text around it. */
  tone?: Tone;
  /** Spins or pulses the glyph. No glyph moves without it. */
  animate?: 'spin' | 'pulse';
  /** Names the glyph to assistive tech, as an image. Without it, the glyph is hidden from them. */
  label?: string;
  /** Added to the SVG's classes. */
  className?: string;
}) {
  const glyph = registry[name];
  const px = ICON_SIZES[size];
  return (
    <svg
      viewBox={glyph.viewBox}
      width={px}
      height={px}
      className={cn(
        'shrink-0',
        // 11 is the text rung. Every one of these exists as literal text in
        // Button's enumerated variants, which is what puts it in the safelist.
        tone ? `text-${TONE_HUE[tone]}-11` : undefined,
        animate === 'spin' && 'animate-spin',
        animate === 'pulse' && 'animate-pulse',
        className,
      )}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      {glyph.node}
    </svg>
  );
}
export type { IconName };
