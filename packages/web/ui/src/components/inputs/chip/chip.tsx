import type { MouseEvent } from 'react';
import {
  axis,
  cn,
  focusRing,
  HUES,
  over,
  TONE_HUE,
  variants,
  type Tone,
} from '../../../style';
import { CONTROL_LADDER, type ControlSize } from '../control';

// Which ramp this component paints from. `scale` is the prop it surfaces as.
const SCALE = axis('scale', HUES, 'indigo');

/**
 * A value inside a multi-value trigger.
 *
 * Chips live ONLY there. A tag on a board card or a detail pane is a `Pill`,
 * which keeps its own four-rung size domain and has no interactive
 * affordances — merging the two would have forced Pill's sizes to be
 * renegotiated against the control ladder and given a display tag a remove
 * button it never needs.
 *
 * Through `variants()` rather than `cn()` because every tone class here is
 * interpolated, and the extractor collects `variants()` output only.
 */
const chipClass = variants({
  base: 'inline-flex items-center gap-4 rounded-control-xs font-sans text-12',
  config: {
    fill: {
      default: 'on',
      options: { on: over(SCALE, (hue) => `bg-${hue}-2 text-${hue}-11`) },
    },
    size: {
      default: 'md',
      options: {
        xs: `${CONTROL_LADDER.xs.chip} pl-6`,
        md: `${CONTROL_LADDER.md.chip} pl-8`,
        lg: `${CONTROL_LADDER.lg.chip} pl-9`,
      },
    },
  },
});

/**
 * The remove target is the WHOLE square, not the glyph drawn inside it.
 *
 * `aspect-square` against the chip's own height is what makes that true: the
 * version everyone ships is a small × floating in a large chip, which is
 * roughly a 10px target inside a 24px one and misses on every touch.
 */
const removeClass = variants({
  base: 'inline-flex aspect-square shrink-0 items-center justify-center rounded-control-xs',
  config: {
    fill: {
      default: 'on',
      options: {
        on: over(SCALE, (hue) => [
          `text-${hue}-11 hover:bg-${hue}-3`,
          focusRing(hue, 'focus-visible', 'inward'),
        ]),
      },
    },
    size: {
      default: 'md',
      options: {
        xs: CONTROL_LADDER.xs.chip,
        md: CONTROL_LADDER.md.chip,
        lg: CONTROL_LADDER.lg.chip,
      },
    },
  },
});

type ChipProps = {
  label: string;
  size?: ControlSize;
  tone?: Tone;
  /** Makes the body a target — used by `+N`, which opens the popup. */
  onClick?: () => void;
  /** Omit entirely for a chip that cannot be removed; no dead × is rendered. */
  onRemove?: () => void;
  className?: string;
};

export function Chip({
  label,
  size = 'md',
  tone = 'primary',
  onClick,
  onRemove,
  className,
}: ChipProps) {
  const scale = TONE_HUE[tone];
  const shell = chipClass({
    scale,
    size,
    // The remove target reaches the chip's own edge, so the shell gives up its
    // right padding rather than leaving a dead strip beside a live square.
    className: cn(onRemove ? 'pr-0' : 'pr-8', className),
  });

  const body = (
    <>
      <span className="min-w-0 truncate">{label}</span>
      {onRemove ? (
        <button
          type="button"
          aria-label={`Remove ${label}`}
          onClick={(event: MouseEvent) => {
            // Nested targets: without this, removing a chip inside a trigger
            // would also open the popup that trigger owns.
            event.stopPropagation();
            onRemove();
          }}
          className={removeClass({ scale, size })}
        >
          <span aria-hidden>×</span>
        </button>
      ) : null}
    </>
  );

  // `+N` is a chip with an onClick rather than a separate component, so
  // overflow is focusable and opens the popup — instead of being decoration
  // that hides values a keyboard user cannot reach.
  if (onClick) {
    return (
      <button
        type="button"
        data-chip
        onClick={onClick}
        className={cn(shell, focusRing(scale, 'focus-visible', 'inward'))}
      >
        {body}
      </button>
    );
  }
  return (
    <span data-chip className={shell}>
      {body}
    </span>
  );
}
