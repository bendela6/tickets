import { useRef, useState, type KeyboardEvent } from 'react';
import { useDrag } from '@bh/hooks';

// Two panes side by side, split where the reader drags the line between
// them or moves it with the arrow keys: a share of the box, read off the
// box as the drag starts. A plain separator, with no component of bh's.

const MIN = 0.2;
const MAX = 0.8;
const STEP = 0.05;
const STEPS: Partial<Record<string, number>> = { ArrowLeft: -STEP, ArrowRight: STEP };

// Kept to hundredths, so the steps add up to the stops they show.
const clamp = (share: number) => Math.min(MAX, Math.max(MIN, Math.round(share * 100) / 100));

export function ASplitByShare() {
  const [share, setShare] = useState(0.5);
  const box = useRef<HTMLDivElement>(null);
  // The box is measured once, as the drag starts, and comes with each move
  // as `from`: the share is where the pointer is across it. With no box to
  // measure, `false` lets the press go by.
  const drag = useDrag<DOMRect>({
    onStart: () => box.current?.getBoundingClientRect() ?? false,
    onMove: ({ x, from }) => setShare(clamp((x - from.left) / from.width)),
  });
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = STEPS[event.key];
    if (step !== undefined) {
      event.preventDefault();
      setShare((now) => clamp(now + step));
    }
  };
  const percent = Math.round(share * 100);
  return (
    <div
      ref={box}
      className="border-gray-6 rounded-8 text-12/17 text-gray-11 flex h-120 w-400 overflow-hidden border-1 font-mono tabular-nums"
    >
      <div
        style={{ width: `${String(percent)}%` }}
        className="border-gray-6 flex shrink-0 items-center justify-center border-r-1"
      >
        {percent}%
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Split the panes"
        // A screen reader says the share as a percentage.
        aria-valuenow={percent}
        aria-valuemin={Math.round(MIN * 100)}
        aria-valuemax={Math.round(MAX * 100)}
        tabIndex={0}
        {...drag.getHandleProps({ onKeyDown })}
        className="group/line relative z-10 -mx-6 flex w-12 shrink-0 cursor-col-resize touch-none items-center justify-center outline-none"
      >
        <span
          className={
            drag.isDragging
              ? 'bg-indigo-9 h-32 w-3 rounded-full'
              : 'bg-gray-6 group-hover/line:bg-gray-8 group-focus-visible/line:bg-indigo-9 h-32 w-3 rounded-full transition-colors'
          }
        />
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-center">{100 - percent}%</div>
    </div>
  );
}
