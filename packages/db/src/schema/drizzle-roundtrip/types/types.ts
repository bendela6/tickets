// A COPY of the eer app's engine/model/types/types.ts, not a move: import-drizzle
// and export-drizzle need this model vocabulary, but the eer app still owns the
// original (the editor and diagram engine depend on it too) until Task 2 of
// the eer-web-module plan moves the engine into apps/web wholesale. packages/db
// must never import across the workspace into the eer app, so this package gets
// its own copy rather than a relative reach-across. The duplication is
// intentionally short-lived — it ends when the eer app is deleted (Task 9).
//
// Group nesting is unbounded as a product feature; this is only a
// runaway/corruption backstop (a cyclic or absurdly deep parent chain in a
// hand-edited file). load-model detaches anything past it to the root.
export const MAX_GROUP_DEPTH = 12;

export type RoutingMode = 'curved' | 'avoid' | 'ortho';
export type Side = 'L' | 'R';
export type Cardinality = '1-1' | '1-n' | 'n-1' | 'n-m';
export type LineStyle = 'solid' | 'dashed';

export type FkAction = 'cascade' | 'restrict' | 'set null' | 'set default' | 'no action';
export type Constraint =
  | { id: string; kind: 'pk'; name: string | null; columns: string[] }
  | { id: string; kind: 'unique'; name: string | null; columns: string[]; nullsNotDistinct: boolean }
  | { id: string; kind: 'check'; name: string | null; expression: string }
  | {
      id: string;
      kind: 'fk';
      name: string | null;
      columns: string[];
      refSchema: string | null;
      refTable: string;
      refColumns: string[];
      onDelete: FkAction | null;
      onUpdate: FkAction | null;
    };

export interface IndexColumn {
  expression: string; // a column name, or raw SQL when isExpression
  isExpression: boolean;
  order: 'asc' | 'desc' | null;
  nulls: 'first' | 'last' | null;
  opClass: string | null;
}

export interface TableIndex {
  id: string;
  name: string;
  columns: IndexColumn[];
  unique: boolean;
  method: string | null; // 'btree' | 'gin' | 'gist' | 'hash' | 'brin'
  only: boolean; // ONLY, as exposed by getTableConfig
  where: string | null; // partial-index predicate, rendered SQL text
}

export interface Point {
  x: number;
  y: number;
}

export interface Identity {
  always: boolean;
  name: string | null;
  increment: string | null;
  minValue: string | null;
  maxValue: string | null;
  startWith: string | null;
  cache: string | null;
  cycle: boolean | null;
}

export interface Generated {
  expression: string;
  stored: true; // Postgres only has STORED
}

export interface Column {
  name: string;
  type: string;
  title: string | null;
  description: string | null;
  nullable: boolean;
  default: string | null;
  identity: Identity | null;
  generated: Generated | null;
}

export interface EnumDecl {
  name: string;
  values: string[];
  schema: string | null;
}

export interface Entity {
  id: string;
  label: string;
  group: string;
  description: string | null;
  schema: string | null; // null = public
  columns: Column[];
  constraints: Constraint[];
  indexes: TableIndex[];
  // layout fills these:
  x: number;
  y: number;
  _w: number;
  _h: number;
}

export interface Group {
  id: string;
  label: string;
  order: number;
  // When set, this group is nested inside the group with this id. Nesting is
  // unbounded — a parent may itself be nested — the chain just has to stay
  // acyclic (enforced at load and on edit).
  parent: string | null;
}

export interface EdgeKind {
  id: string;
  label: string;
  style: LineStyle;
}

export interface Relationship {
  id: string;
  source: string;
  sourceField: string;
  target: string;
  targetField: string;
  cardinality: Cardinality;
  cardinalityInferred: boolean;
  kind: string | null;
  label: string | null;
}

export interface GroupBounds {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  parent: string | null;
  level: number; // nesting depth: 0 = root zone, 1 = subgroup, 2+ = deeper
}

export interface SavedLayout {
  entities: Map<string, { x: number; y: number }>;
  groups: Map<string, { x: number; y: number; w: number; h: number }>;
}

export interface Model {
  meta: { title?: string; description?: string };
  view: { zoom: number; routing: RoutingMode };
  kinds: EdgeKind[];
  kindStyle: Map<string, LineStyle>;
  colors: ReadonlyMap<string, string>; // saved colour overrides (id → hex); ui seeds from this
  _savedLayout?: SavedLayout; // hand-arranged positions from the file; pack re-applies them
  groups: Group[];
  entities: Entity[];
  entityById: Map<string, Entity>;
  enums: EnumDecl[];
  relationships: Relationship[];
  relById: Map<string, Relationship>;
  _groupBounds: GroupBounds[];
  _content: { w: number; h: number };
}

export interface LoadResult {
  model: Model | null;
  errors: string[];
  warnings: string[];
}

export type Focus =
  | { type: 'entity'; id: string }
  | { type: 'group'; id: string }
  | { type: 'edge'; id: string }
  | null;

export type Selection =
  | { type: 'none' }
  | { type: 'entity'; id: string }
  | { type: 'group'; id: string }
  | { type: 'edge'; id: string };

export interface SearchResult {
  kind: 'entity' | 'field';
  label: string;
  entityId: string;
  entityLabel: string;
  field?: string;
  search: string;
}
