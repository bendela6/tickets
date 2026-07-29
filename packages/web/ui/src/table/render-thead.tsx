import type { RenderTheadCtx } from '@tickets/table';

export function renderThead({ children, gridTemplate }: RenderTheadCtx) {
  return (
    <div
      role="row"
      className="sticky top-0 z-10 grid w-max border-b border-gray-6 bg-gray-1"
      style={{ gridTemplateColumns: gridTemplate }}
    >
      {children}
    </div>
  );
}
