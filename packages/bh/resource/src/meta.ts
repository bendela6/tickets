import * as v from 'valibot';
import { ActionMeta } from './actions';
import { Sort } from './query';
import { FieldMeta, ResourceRoles } from './types';

// The resource contract's metadata: what `GET /api/<resource>/meta` answers,
// as a valibot schema first, its type inferred from it so the two can't
// drift. It names which fields play a part in every row (`roles`), describes
// each field (FieldMeta), and says the resource's own order, its actions, and
// what it serves beyond its fields (`serves`).
// Checked against the registered kinds, formats and operators, it is metaOf.

const word = v.pipe(v.string(), v.nonEmpty());

const count = (least: number, most: number) => {
  return v.pipe(v.number(), v.safeInteger(), v.minValue(least), v.maxValue(most));
};

/**
 * What a resource serves beyond its fields, as its source can: a database
 * all of it, an external API often less. A query or a write asking more is
 * refused (queryOf), so a client builds only what will be answered.
 */
export const Serves = v.strictObject({
  /** GET /:id */
  read: v.boolean(),
  /** POST */
  create: v.boolean(),
  /** PATCH /:id */
  update: v.boolean(),
  /** DELETE /:id */
  delete: v.boolean(),
  /** How a filter joins its conditions: by `all` always, by `any` and `not` where these say. */
  filter: v.strictObject({ any: v.boolean(), not: v.boolean() }),
  /** How many fields a query's sort may name: 1 where its source sorts by one. */
  sort: v.strictObject({ max: count(1, 100) }),
  /** Which page shapes a query may ask for (Page). */
  page: v.strictObject({
    /** { skip, take }: any skip; 'pages', a multiple of take alone; 'none', never. */
    numbered: v.picklist(['any', 'pages', 'none']),
    /** { cursor, take }, and `page.next` on each answer. */
    cursor: v.boolean(),
    /** Whether each answer counts every row (`page.total`); its total is null when not. */
    total: v.boolean(),
    /** The most rows a page takes, 500 at most: a page without `take` takes 100, or this when it's less. */
    max: count(1, 500),
  }),
});
export type Serves = v.InferOutput<typeof Serves>;

/** GET /api/<resource>/meta */
export const ResourceMeta = v.strictObject({
  /** 'items': the path segment after /api/ */
  resource: v.pipe(
    v.string(),
    v.regex(/^[A-Za-z][\w-]*$/, 'a resource is named by a word, as its path segment'),
  ),
  /**
   * What a row is called, one and many: {one: 'Item', other: 'Items'}, so a
   * screen built from the metadata says "New item", "1 item", "12 items".
   */
  label: v.strictObject({ one: word, other: word }),
  /** Which field plays each part in every row. */
  roles: ResourceRoles,
  /** In the order a form or a table shows them at first. */
  fields: v.array(FieldMeta),
  /** The order of a query that names none: [{field: 'updatedAt', dir: 'desc'}]. */
  sort: v.array(Sort),
  /**
   * Its operations beyond create, update and delete: deploying a stack,
   * pausing a torrent. [] → none.
   */
  actions: v.array(ActionMeta),
  /** What it serves beyond its fields: its writes, how a filter joins, how it pages. */
  serves: Serves,
});
export type ResourceMeta = v.InferOutput<typeof ResourceMeta>;
