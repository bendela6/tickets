import { useState } from 'react';
import { useResizeHandle } from '@bh/hooks';

// Two panes side by side, split where the reader drags the line between
// them or moves it with the arrow keys. The page holds the share, so a
// button of its own can put it back. A plain separator, with no component of
// bh's: the share is of the box the separator sits in.

export function ASplitThePageHolds() {
  const [share, setShare] = useState(0.5);
  const { isDragging, getSeparatorProps } = useResizeHandle({
    orientation: 'vertical',
    unit: 'share',
    value: share,
    onChange: setShare,
    min: 0.2,
    max: 0.8,
  });
  const percent = Math.round(share * 100);
  return (
    <div className="flex w-full max-w-400 flex-col items-start gap-8">
      <div className="border-gray-6 rounded-8 text-12/17 text-gray-11 flex h-120 w-full overflow-hidden border-1 font-mono tabular-nums">
        <div
          style={{ width: `${String(percent)}%` }}
          className="border-gray-6 flex shrink-0 items-center justify-center border-r-1"
        >
          {percent}%
        </div>
        <div
          {...getSeparatorProps({ 'aria-label': 'Split the panes' })}
          className="group/line relative z-10 -mx-6 flex w-12 shrink-0 cursor-col-resize touch-none items-center justify-center outline-none"
        >
          <span
            className={
              isDragging
                ? 'bg-indigo-9 h-32 w-3 rounded-full'
                : 'bg-gray-6 group-hover/line:bg-gray-8 group-focus-visible/line:bg-indigo-9 h-32 w-3 rounded-full transition-colors'
            }
          />
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-center">{100 - percent}%</div>
      </div>
      <button
        type="button"
        className="rounded-8 border-gray-6 text-13 border-1 px-12 py-6"
        onClick={() => setShare(0.5)}
      >
        Split evenly
      </button>
    </div>
  );
}
