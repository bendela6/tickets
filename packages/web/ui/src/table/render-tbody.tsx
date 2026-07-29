import type { RenderTbodyCtx } from '@tickets/table';

export function renderTbody({ children, totalSize }: RenderTbodyCtx) {
  return (
    <div
      role="rowgroup"
      style={{ height: totalSize, position: 'relative', minWidth: 'max-content' }}
    >
      {children}
    </div>
  );
}
