import { noTemplateLayouts } from './layout-registry';
import { gridLayout, type GridOptions } from './layouts/grid';
import { repeatLayout, type RepeatOptions } from './layouts/repeat';
import { rowLayout, type RowOptions } from './layouts/row';
import { stackLayout, type StackOptions } from './layouts/stack';

/**
 * bh's layouts, by name, with their options. A template typed with them:
 * `TemplateNode<BaseLayouts>`. An app's extend them.
 */
export interface BaseLayouts {
  row: RowOptions;
  stack: StackOptions;
  grid: GridOptions;
  repeat: RepeatOptions;
}

/** bh's four template layouts. Not `baseLayouts`, which are a form's. */
export const baseTemplateLayouts = noTemplateLayouts.register({
  row: rowLayout,
  stack: stackLayout,
  grid: gridLayout,
  repeat: repeatLayout,
});
