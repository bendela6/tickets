import * as v from 'valibot';
import { FieldValue } from './values';

// The resource contract's writes, beside reading one row, as valibot schemas
// first, their types inferred from them so the two can't drift:
//
//   GET    /api/<resource>/:id                   → 200 Row
//   POST   /api/<resource>             Create    → 201 Row
//   PATCH  /api/<resource>/:id         Patch     → 200 Row
//   DELETE /api/<resource>/:id?version=…         → 204
//
// - A write answers the whole row as it is after it, so a client puts it in
//   its cache without reading it again.
// - An `Idempotency-Key` header (a uuid) makes a write safe to repeat: the
//   same key answers the first answer again.
// - DELETE takes its version in the URL, as it has no body, and checks it as
//   PATCH does.
// - A write is checked like a query (createOf, patchOf): a field it may not
//   set, a required one missing or a value of the wrong kind answers
//   `invalid`; a stale version answers `conflict`, and a row that isn't there
//   `not_found`.

/** A write's values, by field key. */
const values = v.record(v.string(), FieldValue);

/**
 * POST's body: the new row's values, by field key; only fields with
 * FieldMeta.write.create, and every required one without a default
 * (FieldMeta.write.default). They sit under `values` so that a resource can
 * have a field called `version`.
 */
export const Create = v.strictObject({ values });
export type Create = v.InferOutput<typeof Create>;

/**
 * PATCH's body: the values that change, by field key; only fields with
 * FieldMeta.write.update. A key left out keeps its value; null, or [] on a
 * many field, clears it, unless the field is required.
 */
export const Patch = v.strictObject({
  values,
  /**
   * The row's version as the client read it: the value of the field its
   * metadata names as the version (ResourceMeta.roles.versionField), for
   * items their updatedAt, '2026-10-14T00:53:56.753Z'. It guards against two
   * people overwriting each other: if the row has changed since, the write
   * answers 409 conflict and nothing is written, so the client can show the
   * newer row instead of silently replacing it. Without it, the last write
   * wins.
   */
  version: v.optional(v.string()),
});
export type Patch = v.InferOutput<typeof Patch>;
