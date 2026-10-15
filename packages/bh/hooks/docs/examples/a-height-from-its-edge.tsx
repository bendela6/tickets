import { useState, type KeyboardEvent } from 'react';
import { useDrag } from '@bh/hooks';

// A box the reader makes taller or shorter from its bottom edge, by the
// pointer or the arrow keys: a value in pixels, which a drag adds its
// distance to. A plain separator, with no component of bh's.

const MIN = 96;
const MAX = 320;
const STEP = 24;
const STEPS: Partial<Record<string, number>> = { ArrowUp: -STEP, ArrowDown: STEP };

const clamp = (px: number) => Math.min(MAX, Math.max(MIN, Math.round(px)));

export function AHeightFromItsEdge() {
  const [height, setHeight] = useState(144);
  // What onStart returns comes with each move as `from`: the height the box
  // had as its edge was grabbed, which the move adds `dy` to.
  const drag = useDrag<number>({
    onStart: () => height,
    onMove: ({ dy, from }) => setHeight(clamp(from + dy)),
  });
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = STEPS[event.key];
    if (step !== undefined) {
      event.preventDefault();
      setHeight((now) => clamp(now + step));
    }
  };
  return (
    <div className="border-gray-6 rounded-8 flex w-320 flex-col overflow-hidden border-1">
      <div style={{ height }} className="text-12/17 text-gray-11 p-12 font-mono tabular-nums">
        {height}px
      </div>
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize the box"
        aria-valuenow={height}
        aria-valuemin={MIN}
        aria-valuemax={MAX}
        tabIndex={0}
        {...drag.getHandleProps({ onKeyDown })}
        className="group/edge border-gray-6 flex h-12 cursor-row-resize touch-none items-center justify-center border-t-1 outline-none"
      >
        <span
          className={
            drag.isDragging
              ? 'bg-indigo-9 h-3 w-32 rounded-full'
              : 'bg-gray-6 group-hover/edge:bg-gray-8 group-focus-visible/edge:bg-indigo-9 h-3 w-32 rounded-full transition-colors'
          }
        />
      </div>
    </div>
  );
}
