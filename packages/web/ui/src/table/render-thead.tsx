import type { RenderTheadCtx } from '@tickets/table';
import { cn } from '../style';
import { HEAD_HEIGHT, ROW_INSET } from './metrics';

export function renderThead({ children, gridTemplate }: RenderTheadCtx) {
  return (
    <div
      role="row"
      // Deliberately no `items-center`: the header cells stretch to the full
      // 36px and centre their own labels instead. A column's resize handle is
      // absolutely positioned against its cell, so a cell that shrank to its
      // label's height would leave a 13px-tall drag target.
      className={cn(
        'sticky top-0 z-10 grid w-full min-w-max border-b border-gray-6 bg-gray-1',
        HEAD_HEIGHT,
        ROW_INSET,
      )}
      style={{ gridTemplateColumns: gridTemplate }}
    >
      {children}
    </div>
  );
}
