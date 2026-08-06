import { axis, focusRing, HUES, over, variants } from '../../../style';
import { disabledClass } from '../control';
import type { ControlSize } from '../control';

// Which ramp this component paints from. `scale` is the prop it surfaces as.
const SCALE = axis('scale', HUES, 'indigo');

/* Checkbox, RadioGroup and Switch share a ladder: 14 / 16 / 20px marks — the
   mark geometry that hangs off the shared ControlSize rungs. */

/**
 * The label row all three wear: the clickable strip holding the mark and its
 * text. Only the gap and the text size change with the rung — the mark's own
 * geometry differs too much between a box, a circle and a track to share.
 */
export const toggleRowClass = variants({
  base: 'group inline-flex cursor-pointer items-center font-sans text-gray-12 has-disabled:cursor-default',
  config: {
    size: {
      default: 'md',
      options: {
        xs: 'gap-6 text-12/17',
        md: 'gap-8 text-13/19',
        lg: 'gap-10 text-15',
      },
    },
  },
});

/**
 * The glyph drawn *on top of* a filled mark — a checkbox's tick, a radio's
 * dot, a switch's thumb. It has to read against the checked fill, so it takes
 * the ramp's contrast token rather than a fixed white.
 */
export const toggleGlyphClass = variants({
  base: 'pointer-events-none absolute',
  config: {
    on: {
      default: 'contrast',
      options: {
        contrast: over(SCALE, (tone) => `text-${tone}-contrast`),
        solid: over(SCALE, (tone) => `bg-${tone}-9`),
      },
    },
  },
});

/**
 * The parts every mark shares regardless of shape: the resting border, the
 * accent it takes when checked, its focus ring, and the disabled treatment.
 * `scale` is the ramp — all three used to hardcode indigo here.
 */
export const toggleMarkClass = variants({
  base: 'peer m-0 shrink-0 appearance-none bg-surface-raised transition-colors',
  config: {
    fill: {
      // `box` fills solid when checked (a checkbox, a switch track); `ring`
      // only takes an accent border and leaves an overlay to draw the mark
      // (a radio's inner dot).
      default: 'box',
      options: {
        box: over(SCALE, (tone) => [
          'border-gray-7',
          `checked:border-${tone}-9 checked:bg-${tone}-9`,
          `indeterminate:border-${tone}-9 indeterminate:bg-${tone}-9`,
          focusRing(tone),
          disabledClass,
        ]),
        ring: over(SCALE, (tone) => [
          'border-gray-7',
          `checked:border-${tone}-9`,
          focusRing(tone),
          disabledClass,
        ]),
      },
    },
  },
});
