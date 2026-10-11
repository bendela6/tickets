import { useRef, useState, type CSSProperties } from 'react';
import { cn } from '../../../style';

/**
 * Text that fades out where it is cut off, and says what it says in full when
 * you hover it.
 *
 * Per B14. Two decisions worth reading:
 *
 * **The fade is a mask, so nothing is measured.** An ellipsis spends three
 * characters saying "there is more" — on a column of file paths that is three
 * characters of the only part you can still read. The design fades the text
 * out instead, and the naive way to do that is to measure every cell and add a
 * gradient to the ones that overflow. It does not need measuring: a mask that
 * fades the last 16px of the BOX affects nothing when the text stops short of
 * it, and fades exactly the right amount when it does not. Long text fades;
 * short text is untouched; no layout is read, on any scroll, ever.
 *
 * It is a mask rather than a gradient overlay because it has to work over four
 * different row colours — default, hover, selected, selected+hover. A gradient
 * in one of them would be visible over the other three. A mask makes the TEXT
 * transparent, so whatever colour the row happens to be is what shows through.
 *
 * **The tooltip measures, but only on hover.** Whether text is clipped is a
 * question worth asking once, when somebody actually wants the answer —
 * `scrollWidth > clientWidth` on the pointer coming in, not on every render of
 * every cell. If it fits, no tooltip appears at all; hovering a column of
 * short values stays completely quiet.
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

/** How long the pointer has to rest before the full value appears. Long enough
 *  that crossing a table does not trail tooltips behind it. */
const HOVER_DELAY_MS = 400;

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
  const [clipped, setClipped] = useState(false);
  const textRef = useRef<HTMLSpanElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onEnter = () => {
    timer.current = setTimeout(() => {
      const el = textRef.current;
      // One pixel of tolerance: sub-pixel text metrics otherwise report a
      // string that visibly fits as overflowing by a fraction.
      setClipped(Boolean(el && el.scrollWidth - el.clientWidth > 1));
    }, HOVER_DELAY_MS);
  };
  const onLeave = () => {
    if (timer.current) {
      clearTimeout(timer.current);
    }
    setClipped(false);
  };

  return (
    // `contents` on the wrapper would lose the hover target, so this is a real
    // box — but a zero-width one in the flow sense: it fills the cell, which is
    // what the text was doing anyway.
    //
    // Deliberately NOT `relative`: the tooltip is positioned against the CELL,
    // which already is. Anchored here instead it would hang off the bottom of
    // a 19px line box and sit inside its own row rather than under it.
    <span className="flex min-w-0 flex-1" onPointerEnter={onEnter} onPointerLeave={onLeave}>
      <span
        ref={textRef}
        className={cn('block w-full overflow-hidden whitespace-nowrap', className)}
        style={align === 'right' ? FADE_START : FADE_END}
      >
        {children}
      </span>
      {/* Below the cell, not over it — you are hovering the thing you want to
          read, so covering it would be perverse. `z-20` and absolute puts it
          over the next row, which is exactly what it needs to do; the row does
          not clip, so it is free to. */}
      {clipped ? (
        <span
          role="tooltip"
          className="bg-gray-12 text-gray-1 text-12/17 rounded-4 absolute top-full left-0 z-20 mt-2 max-w-640 px-8 py-4 font-mono whitespace-nowrap"
        >
          {children}
        </span>
      ) : null}
    </span>
  );
}
