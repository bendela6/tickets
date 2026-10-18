import type * as v from 'valibot';
import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  baseOperators,
  createRegistry,
  type FieldPath,
  type Filter as ResourceFilter,
  type GroupBy,
  type Json,
  type Operator,
  type Scalar,
  type Sort,
} from '@bh/resource';
import type { AnyLayouts, Host, HostSpec, TemplateNode } from '@bh/template';
import {
  type Column,
  columnHost,
  columnOf,
  type ColumnFilter,
  type ColumnFixed,
  type ColumnRegistry,
  type ColumnSort,
  type ColumnWidth,
  type FilterControl,
} from './column';
import {
  viewOf,
  type Density,
  type FilterFormConfig,
  type FilterValue,
  type ItemView,
  type TableView,
  type View,
  type ViewFilters,
} from './view';
import {
  columnsOf,
  resolveState,
  type ColumnState,
  type ResolvedState,
  type ViewState,
  type ViewStates,
} from './state';

// The types the schemas give, held to the ones the docs page writes out by
// hand, so neither drifts from the other.

type Width =
  | { mode: 'fixed'; size: number; min?: number; max?: number }
  | { mode: 'fill'; min?: number; max?: number }
  | { mode: 'auto'; min?: number; max?: number };

type Control =
  | 'select'
  | 'multi-select'
  | 'segmented'
  | 'checkbox'
  | 'toggle'
  | 'text'
  | 'number'
  | 'date'
  | 'date-range'
  | 'user'
  | 'toggle-chips'
  | 'tabs'
  | 'avatars';

type Filter =
  | {
      field: FieldPath;
      op: Operator;
      control: Exclude<Control, 'date-range'>;
      config?: Record<string, Json>;
      map?: Record<string, Scalar | Scalar[] | null>;
      default?: Scalar | Scalar[];
    }
  | {
      field: FieldPath;
      range: [Operator, Operator];
      control: 'date-range';
      config?: Record<string, Json>;
      default?: [Scalar | null, Scalar | null];
    };

interface Fixed {
  key: string;
  label: string;
  width?: Width;
  align?: 'start' | 'center' | 'end';
  pinned?: 'start' | 'end';
  sort?: FieldPath | FieldPath[];
  filter?: Filter;
  hidden?: boolean;
}

describe('the types', () => {
  it('are the schemas’ own', () => {
    expectTypeOf<ColumnWidth>().toEqualTypeOf<Width>();
    expectTypeOf<FilterControl>().toEqualTypeOf<Control>();
    expectTypeOf<ColumnFilter>().toEqualTypeOf<Filter>();
    expectTypeOf<ColumnSort>().toEqualTypeOf<string | string[]>();
    expectTypeOf<ColumnFixed>().toEqualTypeOf<Fixed>();
  });

  it('make a column a host: its fixed parts and its cell, a template', () => {
    expectTypeOf<Column>().toEqualTypeOf<Host<ColumnFixed>>();
    expectTypeOf<Column['template']>().toEqualTypeOf<TemplateNode>();
    expectTypeOf(columnHost).toEqualTypeOf<HostSpec<ColumnFixed>>();
    expectTypeOf<v.InferOutput<typeof Column>>().toEqualTypeOf<Column>();
  });

  it('draw a column’s label and filter, never a setting', () => {
    const spec: HostSpec<ColumnFixed> = {
      fixed: columnHost.fixed,
      // @ts-expect-error a column draws what its fixed parts name, and its template
      order: ['label', 'header', 'template'],
    };
    expect(spec.order).toHaveLength(3);
  });

  it('refuse a column the schemas refuse', () => {
    const cell: TemplateNode = { field: 'status' };
    const columns: Column[] = [
      // @ts-expect-error a width is fixed, fill or auto
      { fixed: { key: 'a', label: 'A', width: { mode: 'grow' } }, template: cell },
      // @ts-expect-error a fixed width has its size
      { fixed: { key: 'a', label: 'A', width: { mode: 'fixed' } }, template: cell },
      // @ts-expect-error a column sits at its start, its center or its end
      { fixed: { key: 'a', label: 'A', align: 'left' }, template: cell },
      {
        fixed: {
          key: 'a',
          label: 'A',
          // @ts-expect-error search writes the query's search, not a column's condition
          filter: { field: 'a', op: 'contains', control: 'search' },
        },
        template: cell,
      },
      {
        fixed: {
          key: 'a',
          label: 'A',
          // @ts-expect-error a range is drawn by a date-range
          filter: { field: 'a', range: ['gte', 'lte'], control: 'select' },
        },
        template: cell,
      },
    ];
    expect(columns).toHaveLength(5);
  });

  it('take an app’s own layouts in a column’s cell', () => {
    interface AppLayouts {
      row: { gap?: number };
      overlay: { anchor: 'top-end' | 'bottom-end' };
    }
    const avatar: Column<AppLayouts> = {
      fixed: { key: 'owner', label: 'Owner', width: { mode: 'fixed', size: 48 } },
      template: {
        layout: 'overlay',
        options: { anchor: 'bottom-end' },
        nodes: [{ field: 'owner' }, { field: 'presence' }],
      },
    };
    expectTypeOf(columnOf<AppLayouts>()).toEqualTypeOf<
      v.GenericSchema<unknown, Column<AppLayouts>>
    >();
    // An untyped column takes any layout.
    const plain: Column = { fixed: avatar.fixed, template: avatar.template };
    expect(plain.fixed.key).toBe('owner');
  });

  it('check against any registry that names its operators', () => {
    expectTypeOf(createRegistry()).toExtend<ColumnRegistry>();
    expectTypeOf({ operators: baseOperators }).toExtend<ColumnRegistry>();
  });
});

interface Base {
  key: string;
  label: string;
  resource: string;
  filters?: {
    form: { nodes: Record<string, Json>[]; [key: string]: Json };
    default?: { search?: string; filter?: ResourceFilter };
  };
  sort?: Sort[];
  group?: GroupBy;
  pageSize?: number;
  density?: 'comfortable' | 'compact';
}

type Views =
  | (Base & { host: 'table'; columns: Column[] })
  | (Base & { host: 'list' | 'tiles' | 'cards'; item: Host<Record<string, Json>> });

describe('a view’s types', () => {
  // A form's config is its nodes and JSON beside them; each way assignable,
  // since an intersection with an index signature is the same object type
  // written another way.
  it('are the ones its page writes out', () => {
    type Form = NonNullable<Base['filters']>['form'];
    expectTypeOf<FilterValue>().toEqualTypeOf<{ search?: string; filter?: ResourceFilter }>();
    expectTypeOf<FilterFormConfig>().toExtend<Form>();
    expectTypeOf<Form>().toExtend<FilterFormConfig>();
    expectTypeOf<ViewFilters>().toExtend<NonNullable<Base['filters']>>();
    expectTypeOf<NonNullable<Base['filters']>>().toExtend<ViewFilters>();
    expectTypeOf<Density>().toEqualTypeOf<'comfortable' | 'compact'>();
    expectTypeOf<View>().toExtend<Views>();
    expectTypeOf<Views>().toExtend<View>();
    expectTypeOf<TableView['columns']>().toEqualTypeOf<Column[]>();
    expectTypeOf<ItemView['item']>().toEqualTypeOf<Host<Record<string, Json>>>();
  });

  it('tell a table from a list, tiles or cards by its host', () => {
    const base = { key: 'a', label: 'A', resource: 'r' };
    const item = { fixed: {}, template: { field: 'x' } };
    const views: View[] = [
      // @ts-expect-error a table shows columns, not an item
      { ...base, host: 'table', item },
      // @ts-expect-error cards show an item, not columns
      { ...base, host: 'cards', columns: [] },
      // @ts-expect-error a board is cards grouped, not a host of its own
      { ...base, host: 'board', item },
    ];
    expect(views).toHaveLength(3);
    const table: TableView = { key: 'a', label: 'A', resource: 'r', host: 'table', columns: [] };
    const tiles: ItemView = {
      key: 'b',
      label: 'B',
      resource: 'r',
      host: 'tiles',
      item: { fixed: { cover: 'photo' }, template: { field: 'name' } },
    };
    expectTypeOf(table).toExtend<View>();
    expectTypeOf(tiles).toExtend<View>();
  });

  it('take an app’s own layouts in its templates', () => {
    interface AppLayouts {
      row: { gap?: number };
      overlay: { anchor: 'top-end' | 'bottom-end' };
    }
    const cards: View<AppLayouts> = {
      key: 'people',
      label: 'People',
      resource: 'users',
      host: 'cards',
      item: {
        fixed: {},
        template: {
          layout: 'overlay',
          options: { anchor: 'top-end' },
          nodes: [{ field: 'photo' }],
        },
      },
    };
    expectTypeOf(viewOf<AppLayouts>()).toEqualTypeOf<v.GenericSchema<unknown, View<AppLayouts>>>();
    // An untyped view takes any layout.
    const plain: View = { ...cards, item: { fixed: {}, template: cards.item.template } };
    expect(plain.key).toBe('people');
  });
});

interface State {
  columns?: { key: string; hidden?: boolean }[];
  widths?: Record<string, number>;
  sort?: Sort[];
  filters?: { search?: string; filter?: ResourceFilter };
  collapsed?: (Scalar | null)[];
}

describe('a view’s state’s types', () => {
  it('are the ones its page writes out', () => {
    expectTypeOf<ColumnState>().toEqualTypeOf<NonNullable<State['columns']>[number]>();
    expectTypeOf<ViewState>().toEqualTypeOf<State>();
    expectTypeOf<ViewStates>().toEqualTypeOf<Record<string, State>>();
    expectTypeOf<ResolvedState>().toEqualTypeOf<{
      columns: { key: string; hidden: boolean }[];
      widths: Record<string, number>;
      sort: Sort[];
      filters?: { search?: string; filter?: ResourceFilter };
      collapsed: (Scalar | null)[];
    }>();
  });

  it('lay a state over any view, and a table’s columns over a table alone', () => {
    expectTypeOf(resolveState<AnyLayouts>).parameters.toEqualTypeOf<[View, ViewState?]>();
    expectTypeOf(columnsOf<AnyLayouts>).returns.toEqualTypeOf<Column[]>();
    const cards: ItemView = {
      key: 'b',
      label: 'B',
      resource: 'r',
      host: 'cards',
      item: { fixed: {}, template: { field: 'name' } },
    };
    // @ts-expect-error cards have no columns to lay out
    const laidOut: Parameters<typeof columnsOf>[0] = cards;
    expect(laidOut.host).toBe('cards');
  });
});
