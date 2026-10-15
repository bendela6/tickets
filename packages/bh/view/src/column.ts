import * as v from 'valibot';
import { createOperatorRegistry, FieldPath, Scalar } from '@bh/resource';
import { defineHost, type BaseLayouts, type Host, type HostSpec, type Layouts } from '@bh/template';
import { holding, jsonObject, nameOf, once, pathTo, pixels, recordOf, templateOf } from './schemas';

// A table's column, as a view stores it: a host (@bh/template's), its fixed
// parts plain values and its cell a template, the same template a list item, a
// tile or a card's body is. The author registers it in a view (TK-16.1); what
// a reader changes (a width dragged, the order, whether it shows) is the
// view's state (TK-16.4), kept by the column's key. Each shape is a valibot
// schema first, its type inferred from it; checked here by its shape, and
// against the resource's metadata (a field that isn't there, an operator its
// field doesn't allow, the cell's template) by validateView (TK-16.5).

/**
 * The inputs a column's filter draws its value with, by their names in a
 * form's input registry: those of the FilterForm design (TK-75.1) that filter
 * one field. Each but date-range holds the operand of one condition, `field op
 * value`; date-range holds a range's two halves. The design's two others
 * don't filter a column: search writes the query's search, and rules hold
 * conditions on any field.
 *
 * Which suits which kind of field, as the design draws them:
 *
 * - an option: toggle-chips, tabs, segmented, select or multi-select;
 * - a ref: select or multi-select, and user or avatars for people;
 * - a date: date, date-range, or number for days back (inLast);
 * - a number: number;
 * - a boolean: checkbox, toggle or segmented;
 * - text: text.
 */
export const FilterControl = v.picklist(
  [
    'select',
    'multi-select',
    'segmented',
    'checkbox',
    'toggle',
    'text',
    'number',
    'date',
    'date-range',
    'user',
    'toggle-chips',
    'tabs',
    'avatars',
  ],
  'a filter’s control is an input that filters one field: select, multi-select, segmented, checkbox, toggle, text, number, date, date-range, user, toggle-chips, tabs or avatars',
);
export type FilterControl = v.InferOutput<typeof FilterControl>;

/** The controls whose value is one condition's operand: every one but date-range. */
const conditionControl = v.picklist(
  FilterControl.options.filter((control) => control !== 'date-range'),
  'a condition’s control is an input whose value is its operand: a date-range filters a range, { range: ["gte", "lte"] }',
);

/** The bounds every width takes: what a reader's drag stays within, and a fill's or an auto's size. */
const bounds = {
  /** The narrowest it gets, in pixels: a drag, a fill or its content making it no narrower. */
  min: v.optional(pixels),
  /** The widest it gets, in pixels. */
  max: v.optional(pixels),
};

/**
 * How wide a column is, in one of three modes, each with the narrowest and
 * the widest it gets (`min`, `max`, in pixels):
 *
 * - `fixed`: `size` pixels, until a reader drags it.
 * - `fill`: the room the table has left, shared alike by every fill column.
 * - `auto`: as wide as its content.
 *
 * `{ mode: 'fill', min: 240 }` takes what's left, never under 240 pixels. A
 * pinned column is best fixed: the table adds pinned widths up to know where
 * each one sticks.
 */
export const ColumnWidth = v.pipe(
  v.variant(
    'mode',
    [
      v.strictObject({ mode: v.literal('fixed'), size: pixels, ...bounds }),
      v.strictObject({ mode: v.literal('fill'), ...bounds }),
      v.strictObject({ mode: v.literal('auto'), ...bounds }),
    ],
    'a width is fixed, fill or auto: { mode: "fixed", size: 120 }',
  ),
  v.rawCheck(({ dataset, addIssue }) => {
    if (!dataset.typed) {
      return;
    }
    const width = dataset.value;
    const { min = 0, max = Infinity } = width;
    if (min > max) {
      addIssue({ message: 'a width’s max is no less than its min', path: pathTo(width, ['max']) });
    } else if (width.mode === 'fixed' && (width.size < min || width.size > max)) {
      addIssue({
        message: 'a fixed width is within its min and max',
        path: pathTo(width, ['size']),
      });
    }
  }),
);
export type ColumnWidth = v.InferOutput<typeof ColumnWidth>;

const sortPaths = v.pipe(
  v.array(FieldPath),
  v.minLength(1, 'a column sorts by one field or more'),
  v.check(once, 'a column sorts by each field once'),
);

/**
 * What a column sorts by: a field's path ('title'), or several, in order
 * (['project', 'number']); each path as @bh/resource's sort takes it. A
 * reader's click sorts by them all, ascending, then descending.
 */
export const ColumnSort = v.lazy((input) => {
  return Array.isArray(input) ? sortPaths : FieldPath;
});
export type ColumnSort = v.InferOutput<typeof ColumnSort>;

/** An operator's name, whichever: the shape alone. */
export const anyOperator = nameOf('a filter names its operator');

/** A value an input holds, or a condition compares with: one, or a list of them. */
const operand = v.union([Scalar, v.array(Scalar)], 'a value, or a list of them');

/** The input's own config, as a form field's `config` is: plain JSON. */
const config = v.optional(jsonObject('a control’s config is a JSON object'));

/**
 * A column's filter, given what checks an operator's name: one condition, or a
 * range, told apart by `range`.
 */
function filterOf(operator: v.GenericSchema<string>) {
  const condition = v.strictObject({
    /** The field it filters, or an option field's attribute: 'status.kind'. */
    field: FieldPath,
    /** Its condition's operator: a registered one's name, 'in'. */
    op: operator,
    /** The input its value is drawn with. */
    control: conditionControl,
    /** What the input takes beside what the metadata fills in: a placeholder, counts. */
    config,
    /**
     * The control's value, as a string key ('true', 'today'), to the operand it
     * writes; null to none. A value it doesn't name is the operand itself.
     */
    map: v.optional(
      recordOf(v.nullable(operand), 'a map turns a value, by its text, into an operand or null'),
    ),
    /** The control's value when the view opens: a value, or a list for one that holds a list. */
    default: v.optional(operand),
  });
  const range = v.strictObject({
    /** The field it filters, or an option field's attribute. */
    field: FieldPath,
    /** Its two halves' operators: the start's and the end's, ['gte', 'lte']. */
    range: v.tuple(
      [operator, operator],
      'a range is two operators, its start’s and its end’s: ["gte", "lte"]',
    ),
    /** A range is drawn by a date-range. */
    control: v.literal('date-range', 'a range is drawn by a date-range'),
    /** What the input takes beside what the metadata fills in. */
    config,
    /** Its two halves when the view opens, null for a half that's open: ['2026-10-01', null]. */
    default: v.optional(
      v.tuple(
        [v.nullable(Scalar), v.nullable(Scalar)],
        'a range’s default is its two halves, null for an open one',
      ),
    ),
  });
  return v.lazy((input) => {
    return holding(input, 'range') ? range : condition;
  });
}

/**
 * The filter in a column's header, on one field: the input a reader sets it
 * with, and what its value writes into the query's filter, as a FilterForm
 * field's `filter` (TK-75) says it, so a column's filter is drawn as a filter
 * form's field is, and read back from the same filter. It is one condition,
 * `field op value`, its value the control's (through `map` when it has one), as
 * `{ field: 'priority', op: 'in', control: 'multi-select' }`; or, drawn by a
 * date-range, a range, `field gte from` and `field lte to`, each half while
 * it's set, as `{ field: 'due', range: ['gte', 'lte'], control: 'date-range' }`.
 * A control's value that is empty writes no condition. `default` is its value
 * when the view opens, and `config` the input's own.
 */
export const ColumnFilter = filterOf(anyOperator);
export type ColumnFilter = v.InferOutput<typeof ColumnFilter>;

/** A column's fixed parts, given what checks an operator's name. */
function fixedOf(operator: v.GenericSchema<string>) {
  return v.strictObject({
    /**
     * What names it in the view and in the view's state: its width, its place
     * and whether it shows are kept by it, never by its label. Unique in its
     * view.
     */
    key: nameOf('a column is named by its key'),
    /** What its header says. */
    label: nameOf('a column’s header says what it shows'),
    /** How wide it is; the table's own width when absent. */
    width: v.optional(ColumnWidth),
    /** Where its header and its cells sit across it; at its start when absent. */
    align: v.optional(
      v.picklist(['start', 'center', 'end'], 'a column sits at its start, its center or its end'),
    ),
    /** Kept in sight at the table's start or its end as the rest scroll by; it scrolls when absent. */
    pinned: v.optional(
      v.picklist(['start', 'end'], 'a column is pinned to the table’s start or its end'),
    ),
    /** What a reader sorts by from its header; it doesn't sort when absent. */
    sort: v.optional(ColumnSort),
    /** The filter in its header; none when absent. */
    filter: v.optional(filterOf(operator)),
    /** Hidden when the view opens, until a reader shows it; shown when absent. */
    hidden: v.optional(v.boolean()),
  });
}

/**
 * A column's fixed parts, its plain values: its key and label, its width,
 * where it sits and whether it's pinned, what it sorts by, its filter, and
 * whether it shows when the view opens. Only the label and the filter are
 * drawn (columnHost's `order`); the rest are settings.
 */
export const ColumnFixed = fixedOf(anyOperator);
export type ColumnFixed = v.InferOutput<typeof ColumnFixed>;

/**
 * A column, a kind of host: its header draws its label, the filter row under
 * it its filter's control, then each row its cell, the template.
 */
export const columnHost: HostSpec<ColumnFixed> = defineHost({
  fixed: ColumnFixed,
  order: ['label', 'filter', 'template'],
});

/**
 * A column as a view stores it: its fixed parts and its cell, the template
 * each row's cell is drawn with (@bh/template's). `L` names the layouts its
 * cell may use: bh's three unless an app adds its own.
 *
 * ```json
 * {
 *   "fixed": { "key": "status", "label": "Status", "sort": "status", "width": { "mode": "fixed", "size": 140 } },
 *   "template": { "field": "status" }
 * }
 * ```
 */
export type Column<L extends Layouts<L> = BaseLayouts> = Host<ColumnFixed, L>;

/**
 * A column's schema, given what checks an operator's name; its cell is JSON
 * with a template's node at its root.
 */
export function columnSchema<L extends Layouts<L>>(
  operator: v.GenericSchema<string>,
): v.GenericSchema<unknown, Column<L>> {
  return v.strictObject({ fixed: fixedOf(operator), template: templateOf<L>() });
}

/**
 * A column's schema, by its shape: its fixed parts, and a cell that is a
 * template. An operator is any name here; columnOf checks it's registered.
 */
export const Column: v.GenericSchema<unknown, Column> = columnSchema(anyOperator);

/**
 * What columnOf and viewOf check against: the operators an app runs with,
 * each by its name. @bh/resource's createRegistry and createOperatorRegistry
 * give them, bh's fifteen and the app's own.
 */
export interface ColumnRegistry {
  readonly operators: readonly { readonly name: string }[];
}

/** An operator's name, one `registry` holds. */
export function registeredOperator(registry: ColumnRegistry): v.GenericSchema<string> {
  const names = new Set(registry.operators.map((operator) => operator.name));
  return v.pipe(
    anyOperator,
    v.check(
      (name) => names.has(name),
      (issue) => `no operator "${String(issue.input)}"`,
    ),
  );
}

/**
 * A column's schema, its filter's operators registered ones: the app's
 * registry's (createRegistry), bh's fifteen when none is given. `L` types its
 * cell's layouts as the app's.
 *
 * ```ts
 * const column = v.parse(columnOf(registry), json);
 * ```
 */
export function columnOf<L extends Layouts<L> = BaseLayouts>(
  registry: ColumnRegistry = createOperatorRegistry(),
): v.GenericSchema<unknown, Column<L>> {
  return columnSchema<L>(registeredOperator(registry));
}
