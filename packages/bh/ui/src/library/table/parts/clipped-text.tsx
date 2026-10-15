import { useIsClipped } from '@bh/hooks';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { cn } from '../../../style';
import { Tooltip } from '../../overlays/components/tooltip';

/**
 * Text that fades out where it is cut off, and says what it says in full when
 * you hover its cell, or move to it by keyboard.
 *
 * Per B14. Two decisions worth reading:
 *
 * **The fade is a mask, so it needs no measuring.** An ellipsis spends three
 * characters saying "there is more" — on a column of file paths that is three
 * characters of the only part you can still read. The design fades the text
 * out instead: a mask that fades the last 16px of the BOX affects nothing when
 * the text stops short of it, and fades exactly the right amount when it does
 * not. Long text fades; short text is untouched.
 *
 * It is a mask rather than a gradient overlay because it has to work over four
 * different row colours — default, hover, selected, selected+hover. A gradient
 * in one of them would be visible over the other three. A mask makes the TEXT
 * transparent, so whatever colour the row happens to be is what shows through.
 *
 * **Only a clipped text has a tooltip.** `useIsClipped` says whether the text
 * runs past its box, measured as the cell mounts and again when the column is
 * resized or the value changes, never on a scroll. While it fits, the cell
 * draws no Tooltip at all, so hovering a column of short values stays
 * completely quiet, and a table of them pays for no tooltip machinery.
 */

/** The fade's width. The spec's 16px, and about a character and a half at this
 *  size: enough to read as "continues", not enough to eat a word. */
const FADE = '16px';

const FADE_END: CSSProperties = {
  maskImage: `linear-gradient(to right, black calc(100% - ${FADE}), transparent)`,
  WebkitMaskImage: `linear-gradient(to right, black calc(100% - ${FADE}), transparent)`,
};

/** Right-aligned text overflows to the LEFT, so its fade belongs at the start. */
const FADE_START: CSSProperties = {
  maskImage: `linear-gradient(to left, black calc(100% - ${FADE}), transparent)`,
  WebkitMaskImage: `linear-gradient(to left, black calc(100% - ${FADE}), transparent)`,
};

/** The end of the cell the tooltip lines up with: the one its text starts from. */
const TOOLTIP_ALIGN = { left: 'start', center: 'center', right: 'end' } as const;

export function ClippedText({
  children,
  align,
  className,
}: {
  children: string;
  /** Which end the text runs off. Follows the column's alignment. */
  align?: 'left' | 'right' | 'center';
  className?: string;
}) {
  const { isClipped, ref } = useIsClipped(children);
  // Two ways in. `asked` is the tooltip's own: a hover opens it, and leaving,
  // a click, Escape, a scroll or another tooltip close it. `focused` is the
  // cell's keyboard focus, below.
  const [asked, setAsked] = useState(false);
  const [focused, setFocused] = useState(false);
  const holder = useRef<HTMLSpanElement | null>(null);

  // A text that comes to fit loses its tooltip, and with it the pointer's
  // leaving, which is what would have closed it: so it closes here, or a later
  // clip would open it with nobody there.
  useLayoutEffect(() => {
    if (!isClipped) {
      setAsked(false);
    }
  }, [isClipped]);

  // The table's keyboard moves focus between its CELLS, a roving tabindex, so
  // the text never has focus of its own for the tooltip to hear. The cell's
  // keyboard focus opens it instead, at once, as a focused trigger's does; a
  // click's focus does not, the pointer having its own way in. It stays open
  // through a scroll, since the arrow that moved focus here scrolls the table
  // to show the row, and goes with the focus, Escape or a click.
  useEffect(() => {
    const cell = holder.current?.closest<HTMLElement>('[role="gridcell"]');
    if (!cell) {
      return;
    }
    const show = () => {
      setFocused(focusVisible(cell));
    };
    const hide = () => {
      setFocused(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        hide();
      }
    };
    cell.addEventListener('focus', show);
    cell.addEventListener('blur', hide);
    cell.addEventListener('keydown', onKeyDown);
    cell.addEventListener('pointerdown', hide);
    // A row the keyboard scrolled into view mounts with its cell focused
    // already, before this could hear it.
    if (cell === cell.ownerDocument.activeElement) {
      show();
    }
    return () => {
      cell.removeEventListener('focus', show);
      cell.removeEventListener('blur', hide);
      cell.removeEventListener('keydown', onKeyDown);
      cell.removeEventListener('pointerdown', hide);
    };
  }, []);

  const text = (
    // As tall as the cell, not the 19px line, so the tooltip hangs under the
    // row rather than inside it, and the whole cell is there to hover.
    <span ref={holder} className="flex min-w-0 flex-1 items-center self-stretch">
      <span
        ref={ref}
        className={cn('block w-full overflow-hidden whitespace-nowrap', className)}
        style={align === 'right' ? FADE_START : FADE_END}
      >
        {children}
      </span>
    </span>
  );
  if (!isClipped) {
    return text;
  }
  // Below the cell, not over it — you are hovering the thing you want to read,
  // so covering it would be perverse. In the cell's face, and wrapping where a
  // value is longer than the tooltip is wide, since all of it is the point.
  return (
    <Tooltip
      content={children}
      open={asked || focused}
      onOpenChange={setAsked}
      side="bottom"
      align={TOOLTIP_ALIGN[align ?? 'left']}
      className={cn('max-w-640 wrap-anywhere', className)}
    >
      {text}
    </Tooltip>
  );
}

function focusVisible(element: Element): boolean {
  try {
    return element.matches(':focus-visible');
  } catch {
    // An engine that can't parse the selector shows it on any focus.
    return true;
  }
}
