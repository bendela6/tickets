import { useResizeHandle } from '@bh/hooks';

// A box the reader makes taller or shorter from its bottom edge, by the
// pointer or the arrow keys, its height held by the hook. A plain separator,
// with no component of bh's.

export function ABoxFromItsEdge() {
  const { value, isDragging, getSeparatorProps, ref } = useResizeHandle<HTMLDivElement>({
    orientation: 'horizontal',
    defaultValue: 144,
    min: 96,
    max: 320,
  });
  return (
    <div className="border-gray-6 rounded-8 flex w-full max-w-320 flex-col overflow-hidden border-1">
      <div
        ref={ref}
        style={{ height: value }}
        className="text-12/17 text-gray-11 p-12 font-mono tabular-nums"
      >
        {value}px
      </div>
      <div
        {...getSeparatorProps({ 'aria-label': 'Resize the box' })}
        className="group/edge border-gray-6 flex h-12 cursor-row-resize touch-none items-center justify-center border-t-1 outline-none"
      >
        <span
          className={
            isDragging
              ? 'bg-indigo-9 h-3 w-32 rounded-full'
              : 'bg-gray-6 group-hover/edge:bg-gray-8 group-focus-visible/edge:bg-indigo-9 h-3 w-32 rounded-full transition-colors'
          }
        />
      </div>
    </div>
  );
}
