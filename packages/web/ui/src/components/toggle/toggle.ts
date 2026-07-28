import { over, TONE, variants } from '../../style';

/** Checkbox, RadioGroup and Switch share a ladder: 14 / 16 / 20px marks. */
export type ToggleSize = 'sm' | 'md' | 'lg';

/**
 * The label row all three wear: the clickable strip holding the mark and its
 * text. Only the gap and the text size change with the rung — the mark's own
 * geometry differs too much between a box, a circle and a track to share.
 */
export const toggleRowClass = variants({
  base: 'group inline-flex cursor-pointer items-center font-sans text-gray-12 has-disabled:cursor-not-allowed',
  config: {
    size: {
      default: 'md',
      options: {
        sm: 'gap-1.5 text-meta',
        md: 'gap-2 text-ui',
        lg: 'gap-2.5 text-[15px]',
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
        contrast: over(TONE, (t) => `text-${t.contrast}`),
        solid: over(TONE, (t) => `bg-${t.solid}`),
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
        box: over(TONE, (t) => [
          'border-gray-7',
          `checked:border-${t.solid} checked:bg-${t.solid}`,
          `indeterminate:border-${t.solid} indeterminate:bg-${t.solid}`,
          t.ring,
          'disabled:cursor-not-allowed disabled:border-gray-6 disabled:bg-surface-inset',
        ]),
        ring: over(TONE, (t) => [
          'border-gray-7',
          `checked:border-${t.solid}`,
          t.ring,
          'disabled:cursor-not-allowed disabled:border-gray-6 disabled:bg-surface-inset',
        ]),
      },
    },
  },
});
