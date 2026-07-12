export type RoutingMode = 'curved' | 'avoid' | 'ortho';
export type Side = 'L' | 'R';
export type Role = 'pk' | 'fk' | null;
export type Cardinality = '1-1' | '1-n' | 'n-1' | 'n-m';
export type LineStyle = 'solid' | 'dashed';

export interface Point {
  x: number;
  y: number;
}

export interface Field {
  name: string;
  type: string;
  role: Role;
  ref: string | null;
  refField: string | null;
  title: string | null;
  description: string | null;
}

export interface Entity {
  id: string;
  label: string;
  group: string;
  description: string | null;
  fields: Field[];
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
  // When set, this group is a subgroup nested inside the zone with this id.
  // One level of nesting only (a subgroup's parent is always a top-level zone).
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
  // routing fills this (avoid/ortho modes):
  _route?: Point[] | null;
  // pin-slot y-offsets so edges sharing a port fan out along the pin bar:
  _srcSlot?: number;
  _tgtSlot?: number;
}

export interface GroupBounds {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  parent: string | null;
  level: number; // 0 = zone, 1 = subgroup
}

export interface Model {
  meta: { title?: string; description?: string };
  view: { zoom: number; routing: RoutingMode };
  kinds: EdgeKind[];
  kindStyle: Map<string, LineStyle>;
  groups: Group[];
  entities: Entity[];
  entityById: Map<string, Entity>;
  relationships: Relationship[];
  relById: Map<string, Relationship>;
  _groupBounds: GroupBounds[];
  _content: { w: number; h: number };
  // per-port (entity|field|side) half-height of the pin bar spanning its slots:
  _pinSpan?: Map<string, number>;
}

export interface LoadResult {
  model: Model | null;
  errors: string[];
  warnings: string[];
}

export interface EdgeEls {
  g: SVGGElement;
  hit: SVGPathElement;
  casing: SVGPathElement;
  path: SVGPathElement;
  head: SVGPathElement; // crow's-foot / tick endpoint decorations
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

export interface EngineEls {
  viewport: HTMLElement;
  world: HTMLElement;
  groupLayer: HTMLElement;
  svg: SVGSVGElement;
  cardLayer: HTMLElement;
  cards: Map<string, HTMLElement>;
  edgeEls: Map<string, EdgeEls>;
}

export interface EngineState {
  model: Model;
  view: { zoom: number; panX: number; panY: number; routing: RoutingMode };
  els: EngineEls;
  selection: string | null;
  focus: Focus;
  hidden: { groups: Set<string>; kinds: Set<string> };
  // User colour overrides keyed by zone/subgroup/entity id; unset ids inherit
  // (entity ← group ← zone ← palette). See group-color / set-colors.
  colors?: ReadonlyMap<string, string>;
  applyTransform: () => void;
}

export interface CheckResult {
  name: string;
  pass: boolean;
  scope: string;
  problems: string[];
}

export interface SearchResult {
  kind: 'entity' | 'field';
  label: string;
  entityId: string;
  entityLabel: string;
  field?: string;
  search: string;
}
