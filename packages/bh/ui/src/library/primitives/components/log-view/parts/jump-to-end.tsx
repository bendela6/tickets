import { useLayoutEffect, useState, type RefObject } from 'react';
import { Button } from '../../button';
import { Icon } from '../../icon';
import { scrollerOf, viewOf } from '../utils/scroller';

interface JumpToEndProps {
  /** How many lines arrived below. */
  unseen: number;
  onJump: () => void;
  /** The log, which the pill centres on. */
  logRef: RefObject<HTMLElement | null>;
}

/**
 * The way back to the end, once the reader has scrolled up from it and lines
 * have arrived: a pill floating at the bottom of what they see, centred on
 * the log, saying how many.
 *
 * Fixed to the window rather than sticky in the log: a log sits in cards and
 * panels that clip what overflows them, and sticky stops at the first.
 * It places itself, so a scroll moves the pill alone, not the log's lines.
 */
export function JumpToEnd({ unseen, onJump, logRef }: JumpToEndProps) {
  const [at, setAt] = useState<{ left: number; bottom: number }>();
  useLayoutEffect(() => {
    const place = () => {
      const log = logRef.current;
      if (log === null) {
        return;
      }
      const { left, width } = log.getBoundingClientRect();
      const view = viewOf(scrollerOf(log));
      const next = { left: left + width / 2, bottom: window.innerHeight - view.bottom + 16 };
      setAt((was) => (was?.left === next.left && was.bottom === next.bottom ? was : next));
    };
    place();
    window.addEventListener('resize', place);
    document.addEventListener('scroll', place, { capture: true, passive: true });
    return () => {
      window.removeEventListener('resize', place);
      document.removeEventListener('scroll', place, { capture: true });
    };
  }, [logRef]);

  return (
    <div
      className="fixed z-10 -translate-x-1/2 font-sans"
      // Where the log is on the screen, measured: no class says it.
      style={at === undefined ? { visibility: 'hidden' } : { left: at.left, bottom: at.bottom }}
    >
      <Button
        variant="solid"
        size="md"
        onClick={onJump}
        className="gap-8 rounded-full whitespace-nowrap shadow-lg"
      >
        <Icon name="arrow-down" size="md" />
        {unseen === 1 ? '1 new line' : `${unseen} new lines`} · Jump to the end
      </Button>
    </div>
  );
}
