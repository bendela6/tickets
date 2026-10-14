import * as v from 'valibot';
import { Row, Scalar } from './values';

// The resource contract's query: what `POST /api/<resource>/query` takes and
// answers, as valibot schemas first, their types inferred from them so the two
// can't drift (Filter, which holds itself, is typed by hand). Every part of
// the body is optional: {} answers the first page of every row, in the
// resource's own sort. The body is checked against the resource's metadata
// before it runs (queryOf): an unknown field, an operator, sort or group the
// field doesn't allow, or a value of the wrong kind answers `invalid`, with
// the path to each problem.

/**
 * A field's key: 'status'. Or an option field's key, a dot and one of its
 * attributes: 'status.kind'. One level, no deeper. A path reaches what an
 * option means rather than which option it is: `status.kind in [done]` holds
 * for every project's finished statuses, whatever each project calls them.
 * It filters, sorts and groups like a field of the attribute's kind.
 */
export const FieldPath = v.pipe(
  v.string(),
  v.nonEmpty('a path names a field'),
  v.check((path) => {
    const parts = path.split('.');
    return parts.length <= 2 && parts.every((part) => part !== '');
  }, 'a path is a field’s key, or its key, a dot and one of its attributes'),
);
export type FieldPath = v.InferOutput<typeof FieldPath>;

/** One field, one operator, and what it compares with. */
export const Condition = v.strictObject({
  field: FieldPath,
  /** One the field allows (FieldMeta.query.filter): a registered operator's name. */
  op: v.pipe(v.string(), v.nonEmpty('a condition names its operator')),
  /**
   * What `op` compares with, as its OperatorSpec's operand schema says;
   * absent for an operator that takes none, as `empty` and `notEmpty` do.
   */
  value: v.optional(v.union([Scalar, v.array(Scalar)])),
});
export type Condition = v.InferOutput<typeof Condition>;

/**
 * Which rows: conditions on their fields, joined by all, any and not. A filter
 * is data, never code: a view stores it as it is, and the server turns it
 * into SQL.
 */
export type Filter =
  // every one holds; { all: [] } keeps every row
  | { all: Filter[] }
  // at least one holds; { any: [] } keeps none
  | { any: Filter[] }
  | { not: Filter }
  | Condition;

/** Whether `input` is an object holding `key`. */
function holding(input: unknown, key: string): boolean {
  return typeof input === 'object' && input !== null && key in input;
}

// A filter inside a filter, checked as the shape its keys say it is, so a
// problem deep in the tree is reported at its own path; anything else is
// checked against all four, which says what a filter may be.
const nested: v.GenericSchema<Filter> = v.lazy((input) => {
  if (holding(input, 'all')) {
    return All;
  }
  if (holding(input, 'any')) {
    return Any;
  }
  if (holding(input, 'not')) {
    return Not;
  }
  return holding(input, 'field') ? Condition : filterShapes;
});

const All = v.strictObject({ all: v.array(nested) });
const Any = v.strictObject({ any: v.array(nested) });
const Not = v.strictObject({ not: nested });

/**
 * The four shapes a filter may take: what Filter's JSON Schema is, by its
 * name, referring to itself.
 */
export const filterShapes: v.GenericSchema<Filter> = v.union(
  [All, Any, Not, Condition],
  'a filter is {all}, {any}, {not} or a condition {field, op, value}',
);

/** Filter's schema: all, any and not over conditions, as deep as it needs. */
export const Filter: v.GenericSchema<Filter> = nested;

/**
 * One key of an order. How each of bh's kinds orders is the contract's rule,
 * the same in every adapter, never an app's own:
 *
 * - text and url: alphabetically, case ignored.
 * - number, date and datetime: by value.
 * - boolean: false, then true.
 * - option: by the option's `order`, never its label, so "by status" is the
 *   workflow's order.
 * - ref: by the title of the row it points at (a user's name, an item's
 *   title), as the server builds it.
 * - json and `many` fields don't sort.
 * - An app's own kind says whether it sorts (KindSpec.sort), and brings its
 *   order to the adapter.
 *
 * Rows without a value come last, both ways. The id breaks ties: the server
 * adds {field: roles.idField, dir: 'asc'} last, so the order is total and the
 * same query answers the same pages while nothing changes, by skip or by
 * cursor.
 */
export const Sort = v.strictObject({
  /** A field whose FieldMeta.query.sort is true, or an attribute of an option field. */
  field: FieldPath,
  dir: v.picklist(['asc', 'desc']),
});
export type Sort = v.InferOutput<typeof Sort>;

/** Rows per page: 1 to 500; 100 when absent. */
const take = v.optional(
  v.pipe(
    v.number(),
    v.integer('a page takes whole rows'),
    v.minValue(1, 'a page takes at least one row'),
    v.maxValue(500, 'a page takes at most 500 rows'),
  ),
);

/**
 * A page, in one of two shapes that never mix: numbered, by skip and take;
 * or the one after a cursor. The first page of a scrolling list is
 * { take: 20 }.
 *
 * - Numbered pages let a table jump to any page and number its pages; but a
 *   row added or removed before the page between two requests shifts every
 *   later page by one, so a row can show twice or not at all, and a deep page
 *   is slow, since the database walks past every skipped row.
 * - A cursor serves a list that grows as it scrolls: every answer carries
 *   `page.next`, however its page was asked for, and a query that passes it
 *   back starts right after the last row it got. Rows written between two
 *   pages then aren't skipped or shown twice unless their place in the order
 *   changed, and a late page costs what the first does.
 * - A cursor is opaque: a client passes back what it got and never builds
 *   one. It is good only for the query that made it, with the same filter,
 *   search and sort; another query's answers `invalid` at `page.cursor`.
 * - A page with `cursor` beside `skip` answers `invalid` at `page`.
 * - Both page in the sort's total order, so the same query answers the same
 *   pages while nothing changes.
 */
export const Page = v.union(
  [
    v.strictObject({
      /** Rows to pass over first: 0 when absent. */
      skip: v.optional(
        v.pipe(
          v.number(),
          v.integer('a page passes over whole rows'),
          v.minValue(0, 'a page passes over no fewer than 0 rows'),
        ),
      ),
      /** Rows per page: 1 to 500; 100 when absent. */
      take,
      /** Never beside skip: a page after a cursor is the other shape. */
      cursor: v.optional(v.never()),
    }),
    v.strictObject({
      /** The `next` of the page before. */
      cursor: v.pipe(v.string(), v.nonEmpty('a cursor is the text the page before answered')),
      /** Rows per page: 1 to 500; 100 when absent. */
      take,
      /** Never beside a cursor: a numbered page is the other shape. */
      skip: v.optional(v.never()),
    }),
  ],
  'a page is {skip, take} or {cursor, take}, never both',
);
export type Page = v.InferOutput<typeof Page>;

/** Where an answered page sits: QueryResult.page. */
export const PageResult = v.strictObject({
  /** The cursor of the page after this one; null on the last page. */
  next: v.nullable(v.string()),
  /**
   * Every row the filter and search keep, on every page, numbered or not: a
   * table numbers its pages by it ("page 3 of 12"), and a scrolling list says
   * how many there are.
   */
  total: v.pipe(v.number(), v.safeInteger(), v.minValue(0)),
});
export type PageResult = v.InferOutput<typeof PageResult>;

/**
 * What a query groups by. Asked to group, the server answers the groups and
 * their counts, and no rows. A group's rows load when it's opened, by the
 * same query with the group's `filter` added, `filter: {all: [query.filter,
 * group.filter]}`, without `group`. A board's columns, a list's sections and
 * a project's counts by status are all this.
 *
 * - A row of a `many` field counts in the group of each value it holds, so
 *   the counts can add up to more than the total.
 * - One field at a time: grouping by two (project, then status) isn't in it.
 * - A group's label comes from the metadata (OptionMeta.label) or, for a ref,
 *   from the resource its `of` names: the fields its `roles.titleField` and
 *   `roles.imageField` name.
 */
export const GroupBy = v.strictObject({
  /**
   * An option, ref or boolean field whose FieldMeta.query.group is true, or
   * an attribute: 'status.kind'.
   */
  field: FieldPath,
  /** The groups in the field's sort order (Sort); asc when absent. */
  dir: v.optional(v.picklist(['asc', 'desc'])),
  /**
   * Also answer the groups no row holds, with count 0: a board's empty
   * columns. They are an option field's options (an attribute's, by a path),
   * a boolean's true and false, and a ref's every row of the resource it
   * points at.
   */
  all: v.optional(v.boolean()),
});
export type GroupBy = v.InferOutput<typeof GroupBy>;

/** One group of a grouped query's answer. */
export const Group = v.strictObject({
  /** The value its rows hold; null for the rows that hold none. */
  key: v.nullable(Scalar),
  /** Its rows that the filter and search keep. */
  count: v.pipe(v.number(), v.safeInteger(), v.minValue(0)),
  /**
   * What picks its rows: equals the key, in [key] on a many field, empty for
   * null.
   */
  filter: Filter,
});
export type Group = v.InferOutput<typeof Group>;

/** POST /api/<resource>/query: the body. */
export const Query = v.strictObject({
  /** Which rows, by their fields. */
  filter: v.optional(Filter),
  /**
   * Which rows, by their text: 1 to 200 characters, kept where a field whose
   * FieldMeta.query.search is true contains it, case ignored. The term is
   * matched whole, as one piece of text: "login fix" doesn't find "fix
   * login"; words, ranking and highlighting aren't in it. The filter and the
   * search both hold.
   */
  search: v.optional(
    v.pipe(
      v.string(),
      v.minLength(1, 'search for at least one character'),
      v.maxLength(200, 'search for at most 200 characters'),
    ),
  ),
  /** Their order; the resource's own (ResourceMeta.sort) when absent. */
  sort: v.optional(v.array(Sort)),
  /** Which page: numbered, or the one after a cursor; the first 100 rows when absent. */
  page: v.optional(Page),
  /** Groups and their counts instead of rows. */
  group: v.optional(GroupBy),
  /**
   * The keys each row carries; every field when absent. The id and the fields
   * its `roles` name always come, so a row can be named. Keys, not paths: an
   * unknown key answers `invalid`.
   */
  fields: v.optional(v.array(v.pipe(v.string(), v.nonEmpty('a field is named by its key')))),
});
export type Query = v.InferOutput<typeof Query>;

/** POST /api/<resource>/query: the answer. */
export const QueryResult = v.strictObject({
  /** The page's rows, in the query's order; [] when the query grouped. */
  rows: v.array(Row),
  /** When the query grouped: its groups, in the field's order. */
  groups: v.optional(v.array(Group)),
  /** The next page's cursor, and the total. */
  page: PageResult,
});
export type QueryResult = v.InferOutput<typeof QueryResult>;
