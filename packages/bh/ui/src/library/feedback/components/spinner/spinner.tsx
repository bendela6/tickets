import { Icon, type IconName, type IconSize } from '../../../primitives/components/icon';
import type { Tone } from '../../../../style/tones';

/**
 * Which busy mark to spin.
 *
 * `arc` is the default sweep. `dashed` is quieter — a dotted ring that reads as
 * ambient rather than blocking, for a background refresh the user did not ask
 * for. `pulse` does not rotate at all: it fades a filled dot, for a heartbeat
 * or a live indicator where spinning would imply work that finishes.
 */
export type SpinnerVariant = 'arc' | 'dashed' | 'pulse';

const GLYPH: Record<SpinnerVariant, IconName> = {
  arc: 'arc',
  dashed: 'circle-dashed',
  pulse: 'dot',
};

const ANIMATE: Record<SpinnerVariant, 'spin' | 'pulse'> = {
  arc: 'spin',
  dashed: 'spin',
  pulse: 'pulse',
};

// A thin preset over Icon's animations — the one busy indicator every screen
// reaches for instead of hand-rolling a CSS border-ring spinner. It shares
// Icon's size ladder because it is an icon.
//
// `tone` is unset by default (no default value), exactly like Icon: an
// unset tone applies no color class, so the spinner inherits `currentColor`
// from its surroundings (e.g. a button's own text color) rather than forcing
// a particular tone that callers then have to fight with a className override.
/** A mark that moves while something loads. */
export function Spinner({
  variant = 'arc',
  size = 'md',
  tone,
  label = 'Loading',
  className,
}: {
  /** Which mark: a spinning arc, a spinning dashed ring, or a fading dot. */
  variant?: SpinnerVariant;
  /** A rung of Icon's ladder, 8 to 28 pixels. */
  size?: IconSize;
  /** Which ramp it paints from. Unset, it takes the colour of the text around it. */
  tone?: Tone;
  /** What a screen reader announces. An empty string hides it from assistive tech. */
  label?: string;
  /** Added to the SVG's classes. */
  className?: string;
}) {
  return (
    <Icon
      name={GLYPH[variant]}
      size={size}
      tone={tone}
      animate={ANIMATE[variant]}
      label={label}
      className={className}
    />
  );
}
