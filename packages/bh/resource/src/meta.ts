import * as v from 'valibot';
import { ActionMeta } from './actions';
import { Sort } from './query';
import { FieldMeta, ResourceRoles } from './types';

// The resource contract's metadata: what `GET /api/<resource>/meta` answers,
// as a valibot schema first, its type inferred from it so the two can't
// drift. It names which fields play a part in every row (`roles`), describes
// each field (FieldMeta), and says the resource's own order and its actions.
// Checked against the registered kinds, formats and operators, it is metaOf.

const word = v.pipe(v.string(), v.nonEmpty());

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
});
export type ResourceMeta = v.InferOutput<typeof ResourceMeta>;
