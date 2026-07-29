import type { RenderTrCtx } from '@tickets/table';
import { cn } from '../style';

export function renderTr<T>({ index, cells, gridTemplate, style, onClick }: RenderTrCtx<T>) {
  return (
    <div
      role="row"
      data-index={index}
      onClick={onClick}
      className={cn(
        // `group` is load-bearing: ActionsColumn reveals its buttons on
        // group-hover, so removing it silently hides every row action.
        'group grid border-b border-gray-6 transition-colors hover:bg-gray-1',
        onClick && 'cursor-pointer',
      )}
      // `right: auto` + `width: max-content` override the engine's stretched
      // absolute positioning so a row is as wide as its columns, letting the
      // whole table scroll horizontally as one.
      style={{ ...style, right: 'auto', width: 'max-content', gridTemplateColumns: gridTemplate }}
    >
      {cells}
    </div>
  );
}
