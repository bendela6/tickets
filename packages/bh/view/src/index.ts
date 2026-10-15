// A view, as JSON: a resource, its host (a table, a list, tiles or cards), the
// host's fixed parts and templates, its filters and its sort, checked by
// valibot, as bh's forms are. It holds no functions, so a view is stored as it
// is; what its author registers (the definition) is kept apart from what a
// reader changes (the state). It imports no React and no DOM, only
// @bh/resource, @bh/template and valibot, so a server checks and stores a view
// as a browser draws it.
export {
  Column,
  ColumnFilter,
  ColumnFixed,
  ColumnSort,
  ColumnWidth,
  FilterControl,
  columnHost,
  columnOf,
  type ColumnRegistry,
} from './column';
export {
  Density,
  FilterFormConfig,
  FilterValue,
  ItemHost,
  View,
  ViewFilters,
  viewOf,
  type ItemView,
  type TableView,
  type ViewBase,
  type ViewItem,
} from './view';
export {
  ColumnState,
  ViewState,
  ViewStates,
  columnsOf,
  resolveState,
  type ResolvedState,
} from './state';
