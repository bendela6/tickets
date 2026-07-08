// Mirror of @tickets/db's SchemaGraph (the GET /api/schema payload). Kept local
// so the web bundle takes no runtime dependency on the db package.
export type ColumnMeta = {
  name: string;
  type: string;
  notNull: boolean;
  pk: boolean;
  fk: { table: string; column: string } | null;
};
export type UniqueMeta = { name: string; columns: string[] };
export type TableMeta = {
  name: string;
  group: string;
  columns: ColumnMeta[];
  primaryKey: string[];
  uniques: UniqueMeta[];
};
export type GroupMeta = { key: string; label: string; color: string; tables: string[] };
export type SchemaGraph = { tables: TableMeta[]; groups: GroupMeta[] };
