import type { RenderSkeletonRowCtx } from '@tickets/table';
import { cn } from '../style';
import { cellGutter, ROW_INSET } from './metrics';

export function renderSkeletonRow<T>({ columns, gridTemplate, rowHeight }: RenderSkeletonRowCtx<T>) {
  return (
    <div
      data-skeleton-row
      // Same inset and gutters as a real row: a skeleton that sat on different
      // metrics would visibly shift its columns the moment the data arrived.
      className={cn('grid w-max min-w-full items-center border-b-1 border-gray-6', ROW_INSET)}
      style={{ gridTemplateColumns: gridTemplate, height: rowHeight }}
    >
      {columns.map((col, index) => (
        <div key={col.key} className={cn('flex items-center', cellGutter(index))}>
          <div className="h-8 w-3/5 animate-pulse rounded-sm bg-gray-4" />
        </div>
      ))}
    </div>
  );
}
