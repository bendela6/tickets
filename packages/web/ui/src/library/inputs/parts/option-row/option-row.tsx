import type { ReactNode } from 'react';
import { disabledClass } from '../../contract';
import {
  axis,
  cn,
  cursorRing,
  focusRing,
  HUES,
  over,
  TONE_HUE,
  variants,
  type Tone,
} from '../../../../style';

// Which ramp this component paints from. `scale` is the prop it surfaces as.
const SCALE = axis('scale', HUES, 'indigo');

/**
 * One row of a popup list, carrying the design's three independent channels.
 *
 *   cursor   → an inward ring. The PARENT owns the index.
 *   hover    → a floor step, in CSS only.
 *   selected → a trailing check and 500 weight.
 *
 * The independence IS the contract. The listbox this replaces had a single
 * `active` flag doing the work of the first two, which meant a row could not be
 * selected without also looking cursored — and, worse, `onMouseEnter` moved the
 * keyboard cursor, so a mouse resting anywhere over the list decided what Enter
 * would commit.
 *
 * Hence no `hovered` prop and no mouse handler beyond the click: hover is a
 * pure CSS state that cannot reach React, which makes the old behaviour
 * unexpressible rather than merely absent.
 *
 * Built through `variants()` rather than composed in `cn()` because the ring
 * classes are interpolated per hue, and `extract-safelist.mjs` collects
 * `variants()` output and nothing else — a ring assembled in `cn()` would be
 * invisible to both Tailwind's scanner and the extractor, and compile to
 * nothing with no error anywhere.
 */
const optionRowClass = variants({
  base: [
    'flex h-34 w-full min-w-0 items-center gap-8 rounded-control-xs px-9 text-left',
    'font-sans text-13 text-gray-12',
    'hover:bg-gray-4',
    disabledClass,
  ],
  config: {
    cursor: {
      default: 'off',
      // Both options carry the focus rim: a row can be focused directly when a
      // list is used without an aria-activedescendant input. `cursorRing` is
      // the same rim without a pseudo-class, so a row wearing both shows one
      // signal rather than two competing ones.
      options: {
        off: over(SCALE, (hue) => focusRing(hue, 'focus-visible', 'inward')),
        on: over(SCALE, (hue) => [
          focusRing(hue, 'focus-visible', 'inward'),
          cursorRing(hue),
        ]),
      },
    },
  },
});

const checkClass = variants({
  base: 'shrink-0',
  config: {
    check: {
      default: 'on',
      options: { on: over(SCALE, (hue) => `text-${hue}-11 dark:text-${hue}-9`) },
    },
  },
});

type OptionRowProps = {
  children: ReactNode;
  /** This row is the value. Drawn as a trailing check plus 500 weight. */
  selected?: boolean;
  /** This row is where the keyboard is. Drawn as an inward ring. */
  cursor?: boolean;
  disabled?: boolean;
  /** A dot, an avatar or an icon before the label — data, not decoration. */
  leading?: ReactNode;
  /** A count or a hint after the label. The selection check is drawn separately. */
  trailing?: ReactNode;
  tone?: Tone;
  onPick: () => void;
  id?: string;
  className?: string;
};

export function OptionRow({
  children,
  selected = false,
  cursor = false,
  disabled = false,
  leading,
  trailing,
  tone = 'primary',
  onPick,
  id,
  className,
}: OptionRowProps) {
  const scale = TONE_HUE[tone];
  return (
    <button
      type="button"
      role="option"
      id={id}
      // Follows SELECTION, never the cursor. The parent points at the cursor
      // row with aria-activedescendant; if this tracked the cursor too, a
      // screen reader would announce every row as selected while arrowing.
      aria-selected={selected}
      disabled={disabled}
      onClick={() => {
        if (!disabled) onPick();
      }}
      className={optionRowClass({
        cursor: cursor ? 'on' : 'off',
        scale,
        className: cn(selected && 'font-500', className),
      })}
    >
      {leading}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {trailing}
      {selected ? (
        <span aria-hidden className={checkClass({ scale })}>
          ✓
        </span>
      ) : null}
    </button>
  );
}
