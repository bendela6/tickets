// The engine is @tickets/table. This subtree is the styled adapter: the default
// `tableRender` plus the cell-content helpers in `columns/`.
//
// There is no <Table> component here, which is why this group has `columns/`
// where every other group has `components/`. What you reach for is a factory,
// called as `render={tableRender<Row>()}`.
//
// `parts/` has no barrel and is not re-exported here, unlike `inputs/` and
// `overlays/` which both `export * from './parts'`. Wiring one up would add
// ~30 render-slot names to this package's public surface for no consumer —
// this file already imports `./parts/metrics` by name and `table-render.ts`
// imports each `./parts/render-*` individually. Keep it that way.
export { tableRender } from './table-render';
export { rowHeightFor, CELL_FOCUS_RING, type Density } from './parts/metrics';
export * from './columns';
