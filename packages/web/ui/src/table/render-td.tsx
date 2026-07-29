import type { RenderTdCtx } from '@tickets/table';
import { cn } from '../style';
import { cellGutter } from './metrics';

function alignClass(align: 'left' | 'right' | 'center' | undefined) {
  return align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';
}

export function renderTd<T>({ column, index, children }: RenderTdCtx<T>) {
  return (
    <div
      // `flex min-w-0` rather than a plain block: it is what lets a cell's
      // content use `truncate`, which needs a shrinkable box to ellipsize
      // against.
      className={cn('flex min-w-0 items-center', cellGutter(index), alignClass(column.align))}
      role="cell"
    >
      {children}
    </div>
  );
}
