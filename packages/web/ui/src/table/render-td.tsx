import type { RenderTdCtx } from '@tickets/table';
import { cn } from '../style';

function alignClass(align: 'left' | 'right' | 'center' | undefined) {
  return align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';
}

export function renderTd<T>({ column, children }: RenderTdCtx<T>) {
  return (
    <div className={cn('flex min-w-0 items-center px-3', alignClass(column.align))} role="cell">
      {children}
    </div>
  );
}
