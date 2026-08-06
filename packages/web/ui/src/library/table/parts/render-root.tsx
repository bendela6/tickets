import type { RenderRootCtx } from '@tickets/table';

export function renderRoot({ children }: RenderRootCtx) {
  // `role="grid"` is the legal parent ARIA requires for the descendant
  // `row`/`rowgroup`/`columnheader`/`cell` roles below — without it those
  // roles have no table ancestor and the sorted/resizable header row has no
  // legal parent at all. `grid` rather than `table`: rows are clickable and
  // columns are sortable and resizable, i.e. interactive.
  return (
    <div role="grid" className="w-full min-w-max font-sans text-13/19 text-gray-12">
      {children}
    </div>
  );
}
