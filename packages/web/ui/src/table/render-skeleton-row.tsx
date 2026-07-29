import type { RenderSkeletonRowCtx } from '@tickets/table';

export function renderSkeletonRow<T>({ columns, gridTemplate, rowHeight }: RenderSkeletonRowCtx<T>) {
  return (
    <div
      data-skeleton-row
      className="grid w-max min-w-full border-b border-gray-6"
      style={{ gridTemplateColumns: gridTemplate, height: rowHeight }}
    >
      {columns.map((col) => (
        <div key={col.key} className="flex items-center px-3">
          <div className="h-2 w-3/5 animate-pulse rounded-sm bg-gray-4" />
        </div>
      ))}
    </div>
  );
}
