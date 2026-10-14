import * as v from 'valibot';

// The values a row holds, as valibot schemas first, their types inferred from
// them so the two can't drift.

const finite = v.pipe(v.number(), v.finite());

/** One value: text, a finite number, or a boolean. */
export const Scalar = v.union([v.string(), finite, v.boolean()]);
export type Scalar = v.InferOutput<typeof Scalar>;

/** Any JSON value: a number finite, an object of string keys. */
export type Json = null | Scalar | Json[] | { [key: string]: Json };
// Its lists and objects hold it again, lazily, so its JSON Schema names it and
// refers to itself.
export const Json: v.GenericSchema<Json> = v.union([
  v.null(),
  Scalar,
  v.array(v.lazy(() => Json)),
  v.record(
    v.string(),
    v.lazy(() => Json),
  ),
]);

/** A row's id, as its table has it: a string that isn't empty, or a whole number. */
export const Id = v.union(
  [v.pipe(v.string(), v.nonEmpty()), v.pipe(v.number(), v.safeInteger())],
  'an id is a string or a whole number',
);
export type Id = v.InferOutput<typeof Id>;

/**
 * A field's value is its kind's (KindValue), null when unset; a `many` field's
 * is a list of them, [] when unset.
 */
export const FieldValue = v.union([v.null(), Scalar, v.array(Scalar), Json]);
export type FieldValue = v.InferOutput<typeof FieldValue>;

/**
 * A row: its fields' values by key; a key that a query's `fields` left out is
 * absent.
 */
export const Row = v.record(v.string(), FieldValue);
export type Row = v.InferOutput<typeof Row>;
