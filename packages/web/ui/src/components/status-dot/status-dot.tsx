import { axis, cn, HUE_TONES, over, TONE_RAMP, variants, type Tone } from '../../style';

// Something running right now has to be findable with peripheral vision, and something
// stopped has to recede without disappearing. Colour alone cannot carry that, so the
// states differ by shape as well: active is a filled dot, resting is a hollow ring.
// The meaning is also written out for screen readers — never colour-only.
//
// Deliberately only two states. Anything richer — blocked, failed, queued — is a
// caller's vocabulary, not this library's, and belongs in a Pill next to the dot.

const SCALE = axis('scale', HUE_TONES, 'green');

export type StatusDotState = 'active' | 'resting';

const dotClass = variants({
  base: 'size-2 shrink-0 rounded-full',
  config: {
    fill: {
      default: 'solid',
      options: {
        solid: over(SCALE, (tone) => `bg-${tone}-9`),
        hollow: over(SCALE, (tone) => `border-2 border-${tone}-8`),
      },
    },
  },
});

/**
 * A small activity indicator.
 *
 * The dot is decorative; the state is exposed as text for assistive technology.
 * `label` overrides that text when the caller's word for it is more useful than
 * "active" — a session is *live*, a job is *running*.
 */
export function StatusDot({
  state,
  tone = 'success',
  label,
  className,
}: {
  state: StatusDotState;
  /** Which ramp the active dot paints from. Resting always reads as neutral. */
  tone?: Tone;
  label?: string;
  className?: string;
}) {
  const active = state === 'active';
  return (
    <span className={cn('inline-flex items-center', className)}>
      <span
        aria-hidden
        className={cn(
          dotClass({
            fill: active ? 'solid' : 'hollow',
            scale: TONE_RAMP[active ? tone : 'neutral'],
          }),
          active && 'motion-safe:animate-pulse',
        )}
      />
      <span className="sr-only">{label ?? state}</span>
    </span>
  );
}
