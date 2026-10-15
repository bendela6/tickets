import { useElementSize } from '@bh/hooks';

// A box the reader resizes from its corner, which draws as many bars as fit
// its width and says its size: a plain div, with no component of bh's.

const BAR = 24;
const GAP = 8;

export function ABoxThatKnowsItsWidth() {
  const { width = 0, height = 0, ref } = useElementSize<HTMLDivElement>();
  const bars = Math.max(0, Math.floor((width + GAP) / (BAR + GAP)));
  return (
    <div
      ref={ref}
      className="border-gray-6 rounded-8 flex h-120 w-320 min-w-120 resize flex-col justify-between overflow-hidden border-1 p-12"
    >
      <span className="text-12/17 text-gray-11 font-mono tabular-nums">
        {Math.round(width)} × {Math.round(height)}
      </span>
      <div className="flex items-end gap-8">
        {Array.from({ length: bars }, (_, index) => {
          return (
            <span
              key={index}
              className="bg-indigo-9 rounded-3 w-24 shrink-0"
              style={{ height: 12 + ((index * 7) % 5) * 8 }}
            />
          );
        })}
      </div>
    </div>
  );
}
