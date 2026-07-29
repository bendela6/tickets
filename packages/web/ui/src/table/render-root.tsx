import type { RenderRootCtx } from '@tickets/table';

export function renderRoot({ children }: RenderRootCtx) {
  return <div className="w-max font-sans text-13/19 text-gray-12">{children}</div>;
}
