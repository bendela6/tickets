// The engine is @tickets/table. This subtree is the styled adapter: the default
// `tableRender` plus the cell-content helpers in `columns/`.
//
// There is no <Table> component here, which is why this group has `columns/`
// where every other group has `components/`. What you reach for is a factory,
// called as `render={tableRender<Row>()}`.
export { tableRender } from './table-render';
export { rowHeightFor, CELL_FOCUS_RING, type Density } from './parts/metrics';
export * from './columns';
