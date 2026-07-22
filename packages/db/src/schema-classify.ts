// Fingerprint a database as the new items schema, the old pre-items schema, or
// empty, by two marker tables that each exist in exactly one schema:
//   item_values -> items platform;  statuses -> pre-items ticket schema.
export type SchemaKind = 'new' | 'old' | 'empty';

export function classifySchema(tables: Iterable<string>): SchemaKind {
  const set = new Set(tables);
  if (set.has('item_values')) return 'new';
  if (set.has('statuses')) return 'old';
  return 'empty';
}
