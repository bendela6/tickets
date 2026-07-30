// The engine is @tickets/table. This subtree is the styled adapter: the
// default `tableRender` plus the cell-content helpers in `columns/`.
export { tableRender } from './table-render';
export { rowHeightFor, type Density } from './metrics';
export { TextColumn } from './columns/text-column';
export { NumberColumn } from './columns/number-column';
export { DateColumn } from './columns/date-column';
export { LinkColumn } from './columns/link-column';
export { BadgeColumn } from './columns/badge-column';
export { ImageColumn } from './columns/image-column';
export { ActionsColumn } from './columns/actions-column';
