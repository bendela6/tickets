// Mirror of @tickets/db's SchemaGraph (the GET /api/schema payload). Kept local
// so the web bundle takes no runtime dependency on the db package. It is a
// SUBSET — the db side also carries checks/indexes, which the ERD does not
// draw — but every field it does mirror must match, `schema` above all:
// terminal.sessions and agent.sessions share a bare name, so without it this
// renderer cannot tell two independent subsystems' tables apart.
export type ColumnMeta = {
  name: string;
  type: string;
  notNull: boolean;
  pk: boolean;
  // `schema` is the REFERENCED table's schema (null = public), so an fk to
  // `sessions` names exactly one table. It is the target's own schema, never
  // the referencing table's — an fk routinely crosses schemas
  // (terminal.sessions.workdir_id -> core.workdirs.id).
  fk: { schema: string | null; table: string; column: string } | null;
};
export type UniqueMeta = { name: string; columns: string[] };
export type TableMeta = {
  name: string;
  // The Postgres schema the table lives in. null = public.
  schema: string | null;
  group: string;
  columns: ColumnMeta[];
  primaryKey: string[];
  uniques: UniqueMeta[];
};
// `tables` holds QUALIFIED names (see qualifiedName) — the renderer resolves
// each one against `SchemaGraph.tables`.
export type GroupMeta = { key: string; label: string; color: string; tables: string[] };
export type EnumMeta = { name: string; values: string[]; schema: string | null };
export type SchemaGraph = { tables: TableMeta[]; groups: GroupMeta[]; enums: EnumMeta[] };

// The identity of a table: its bare name in public, `schema.name` otherwise.
// MUST match @tickets/db's qualifiedName() in packages/db/src/schema/
// describe-schema.ts — the db emits GroupMeta.tables using it and this
// renderer resolves them with it, so the two agreeing is what makes a lookup
// hit at all.
export function qualifiedName(schema: string | null, name: string): string {
  return schema && schema !== 'public' ? `${schema}.${name}` : name;
}
