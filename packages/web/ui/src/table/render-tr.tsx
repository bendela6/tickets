import type { RenderTrCtx } from '@tickets/table';
import { cn } from '../style';
import { ROW_INSET } from './metrics';

export function renderTr<T>({ index, cells, gridTemplate, style, onClick }: RenderTrCtx<T>) {
  return (
    <div
      role="row"
      data-index={index}
      onClick={onClick}
      className={cn(
        // `group` is load-bearing: ActionsColumn reveals its buttons on
        // group-hover, so removing it silently hides every row action.
        'group grid items-center border-b border-gray-6 transition-colors hover:bg-gray-1',
        ROW_INSET,
        onClick && 'cursor-pointer',
      )}
      // `right: auto` undoes the engine's stretched absolute positioning;
      // `width: 100%` then gives a flexible `1fr` track (e.g. all-items'
      // Title column) a definite basis to distribute free space against —
      // without it, `1fr` resolves against the row's own max-content
      // contribution and every row's Title track ends up a different width.
      // `minWidth: max-content` keeps fixed-px columns from being squeezed
      // narrower than their tracks, so the table still scrolls horizontally
      // when columns overflow the viewport.
      style={{
        ...style,
        right: 'auto',
        width: '100%',
        minWidth: 'max-content',
        gridTemplateColumns: gridTemplate,
      }}
    >
      {cells}
    </div>
  );
}
