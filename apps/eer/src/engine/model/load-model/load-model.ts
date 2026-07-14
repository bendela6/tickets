// Model loading — pure validation + normalization. No DOM. Given raw JSON it
// returns a normalized model plus errors (block rendering) and warnings (allow it).

import { columnRoles, type ColumnRole } from '../column-roles';
import { deriveRelationships } from '../derive-relationships';
import { CARDINALITIES, inferCardinality } from '../infer-cardinality';
import { formatType, parseType } from '../pg-types';
import type {
  Column,
  Constraint,
  EdgeKind,
  EnumDecl,
  Entity,
  FkAction,
  Generated,
  Group,
  Identity,
  IndexColumn,
  LineStyle,
  LoadResult,
  Model,
  Relationship,
  RoutingMode,
  TableIndex,
} from '../types';

function normalizeRouting(v: unknown): RoutingMode {
  if (v === 'avoid') return 'avoid';
  if (v === 'ortho' || v === 'orthogonal') return 'ortho';
  return 'curved';
}

const FK_ACTIONS: FkAction[] = ['cascade', 'restrict', 'set null', 'set default', 'no action'];

function fkAction(v: unknown): FkAction | null {
  return typeof v === 'string' && FK_ACTIONS.includes(v as FkAction) ? (v as FkAction) : null;
}

// Legacy files describe an index column as a bare column name (string[]).
// The canonical shape is IndexColumn[] — a column name (or raw SQL, when
// isExpression) plus ordering/opClass. Normalised forever, same as the
// `fields` -> `columns` migration.
function normalizeIndexColumn(c: unknown): IndexColumn {
  if (typeof c === 'string') {
    return { expression: c, isExpression: false, order: null, nulls: null, opClass: null };
  }
  const o = c as Record<string, unknown>;
  return {
    expression: typeof o.expression === 'string' ? o.expression : '',
    isExpression: o.isExpression === true,
    order: o.order === 'asc' || o.order === 'desc' ? o.order : null,
    nulls: o.nulls === 'first' || o.nulls === 'last' ? o.nulls : null,
    opClass: typeof o.opClass === 'string' ? o.opClass : null,
  };
}

function normalizeIdentity(v: unknown): Identity | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const str = (k: string) => (typeof o[k] === 'string' ? (o[k] as string) : null);
  return {
    always: o.always === true,
    name: str('name'),
    increment: str('increment'),
    minValue: str('minValue'),
    maxValue: str('maxValue'),
    startWith: str('startWith'),
    cache: str('cache'),
    cycle: typeof o.cycle === 'boolean' ? o.cycle : null,
  };
}

function normalizeGenerated(v: unknown): Generated | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  return typeof o.expression === 'string' ? { expression: o.expression, stored: true } : null;
}

function normalizeConstraint(c: any, i: number, entityId: string, errors: string[]): Constraint {
  const id = typeof c.id === 'string' && c.id ? c.id : 'c' + (i + 1);
  const name = typeof c.name === 'string' && c.name ? c.name : null;
  const columns: string[] = Array.isArray(c.columns) ? c.columns.filter((x: unknown) => typeof x === 'string') : [];
  if (c.kind === 'check') return { id, kind: 'check', name, expression: typeof c.expression === 'string' ? c.expression : '' };
  if (c.kind === 'fk') {
    if (typeof c.refTable !== 'string') errors.push(`Entity "${entityId}" constraint "${id}" is missing "refTable".`);
    const refColumns: string[] = Array.isArray(c.refColumns)
      ? c.refColumns.filter((x: unknown) => typeof x === 'string')
      : [];
    return {
      id, kind: 'fk', name, columns,
      refSchema: typeof c.refSchema === 'string' ? c.refSchema : null,
      refTable: typeof c.refTable === 'string' ? c.refTable : '',
      refColumns, onDelete: fkAction(c.onDelete), onUpdate: fkAction(c.onUpdate),
    };
  }
  if (c.kind === 'unique') return { id, kind: 'unique', name, columns, nullsNotDistinct: c.nullsNotDistinct === true };
  return { id, kind: 'pk', name, columns };
}

// Legacy files describe keys with per-field roles. One PK from every role:'pk'
// field, and one FK per field carrying a ref — regardless of role, because a
// shared-primary-key reference is role 'pk' AND a ref. Reads the RAW json
// fields (role/ref/refField never make it onto the normalized Column — see
// the module header note by the entities loop below).
function synthesizeLegacyConstraints(rawColumns: any[]): Constraint[] {
  const out: Constraint[] = [];
  const pkCols = rawColumns.filter((f) => f.role === 'pk').map((f) => f.name);
  let n = 1;
  if (pkCols.length) out.push({ id: 'c' + n++, kind: 'pk', name: null, columns: pkCols });
  for (const f of rawColumns) {
    if (!f.ref) continue;
    out.push({
      id: 'c' + n++, kind: 'fk', name: null, columns: [f.name],
      refSchema: null, refTable: f.ref, refColumns: [f.refField ?? 'id'], onDelete: null, onUpdate: null,
    });
  }
  return out;
}

export function loadModel(raw: unknown): LoadResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!raw || typeof raw !== 'object') {
    return { model: null, errors: ['Model root must be a JSON object.'], warnings };
  }

  const r = raw as Record<string, any>;
  const groups = Array.isArray(r.groups) ? r.groups : null;
  const entities = Array.isArray(r.entities) ? r.entities : null;
  const relationships = Array.isArray(r.relationships) ? r.relationships : [];

  if (!groups || groups.length === 0) errors.push('Missing or empty required key: "groups".');
  if (!entities || entities.length === 0) errors.push('Missing or empty required key: "entities".');
  if (!Array.isArray(r.relationships) && r.relationships !== undefined)
    errors.push('"relationships" must be an array.');

  // ---- groups ----
  const groupIds = new Set<string>();
  const normGroups: Group[] = (groups || []).map((g: any, i: number) => {
    if (!g.id) errors.push(`groups[${i}] is missing "id".`);
    else if (groupIds.has(g.id)) errors.push(`Duplicate group id "${g.id}".`);
    else groupIds.add(g.id);
    return { id: g.id, label: g.label || g.id, order: g.order ?? i, parent: g.parent ?? null };
  });
  // Resolve nesting: a parent must exist and itself be top-level (one level deep).
  const groupById = new Map(normGroups.map((g) => [g.id, g]));
  for (const g of normGroups) {
    if (g.parent == null) continue;
    const p = groupById.get(g.parent);
    if (!p) {
      warnings.push(`Group "${g.id}" references unknown parent "${g.parent}"; treated as top-level.`);
      g.parent = null;
    } else if (p.parent != null) {
      warnings.push(`Group "${g.id}" nests under subgroup "${g.parent}"; only one level is supported — flattened.`);
      g.parent = null;
    }
  }
  normGroups.sort((a, b) => a.order - b.order);

  // ---- enums (the JSON twin of pgEnum) ----
  // Parsed before the entities loop so a column typed to a declared enum's
  // name doesn't trip the unknown-type warning below.
  const enums: EnumDecl[] = (Array.isArray(r.enums) ? r.enums : []).map((e: any) => ({
    name: typeof e.name === 'string' ? e.name : '',
    values: Array.isArray(e.values) ? e.values.filter((v: unknown) => typeof v === 'string') : [],
    schema: typeof e.schema === 'string' ? e.schema : null,
  }));
  const enumNames = new Set(enums.map((e) => e.name));

  // ---- entities ----
  const entityById = new Map<string, Entity>();
  // Legacy per-field `role`/`ref`/`refField` are read straight off the raw
  // JSON below (Task 2's synthesizeLegacyConstraints still needs them to
  // synthesize pk/fk constraints for old-shaped files) but are never stored on
  // the normalized Column any more — Column has no such fields (see types.ts).
  // `legacyRefs` keeps enough of that raw data around to run the same
  // dangling-ref warnings the old per-field loop used to (unrelated to
  // cardinality — see `rolesByEntity` below for that).
  const legacyRefs: { entityId: string; fieldName: string; ref: string; refField: string | null }[] = [];
  const normEntities: Entity[] = (entities || []).map((e: any) => {
    if (!e.id) errors.push(`entities[?] is missing "id".`);
    else if (entityById.has(e.id)) errors.push(`Duplicate entity id "${e.id}".`);
    if (e.group && !groupIds.has(e.group)) errors.push(`Entity "${e.id}" references unknown group "${e.group}".`);
    if (!e.group) errors.push(`Entity "${e.id}" is missing "group".`);

    // `columns` is the canonical file key; `fields` is the legacy alias every
    // pre-rewrite file (and hand-authored fixture) still uses — accepted
    // forever for back-compat. When a file somehow carries both, `columns`
    // wins.
    const rawColumns: any[] = Array.isArray(e.columns) ? e.columns : Array.isArray(e.fields) ? e.fields : [];
    const seen = new Set<string>();
    const columns: Column[] = rawColumns.map((f: any, fi: number) => {
      if (!f.name) errors.push(`Entity "${e.id}" field[${fi}] is missing "name".`);
      else if (seen.has(f.name)) errors.push(`Entity "${e.id}" has duplicate field "${f.name}".`);
      else seen.add(f.name);
      if (f.ref) legacyRefs.push({ entityId: e.id, fieldName: f.name, ref: f.ref, refField: f.refField || null });

      const parsed = parseType(f.type || '');
      const type = f.type ? formatType(parsed.base, parsed.params, parsed.arrays) : '';
      if (type && !parsed.known && !enumNames.has(parsed.base)) {
        warnings.push(`Column "${e.id}.${f.name}" has unknown type "${parsed.base}".`);
      }

      return {
        name: f.name,
        type,
        title: f.title || null,
        description: f.description || null,
        nullable: f.nullable !== false,
        default: typeof f.default === 'string' ? f.default : null,
        identity: normalizeIdentity(f.identity),
        generated: normalizeGenerated(f.generated),
      };
    });
    if (columns.length === 0) errors.push(`Entity "${e.id}" has no columns.`);

    const rawConstraints = Array.isArray(e.constraints) ? e.constraints : null;
    const constraints: Constraint[] = rawConstraints
      ? rawConstraints.map((c: any, ci: number) => normalizeConstraint(c, ci, e.id, errors))
      : synthesizeLegacyConstraints(rawColumns);
    const indexes: TableIndex[] = (Array.isArray(e.indexes) ? e.indexes : []).map((ix: any, ii: number) => ({
      id: typeof ix.id === 'string' && ix.id ? ix.id : 'i' + (ii + 1),
      name: typeof ix.name === 'string' ? ix.name : '',
      columns: Array.isArray(ix.columns) ? ix.columns.map(normalizeIndexColumn) : [],
      unique: ix.unique === true,
      method: typeof ix.method === 'string' ? ix.method : null,
      only: ix.only === true,
      where: typeof ix.where === 'string' ? ix.where : null,
    }));

    const ne: Entity = {
      id: e.id,
      label: e.label || e.id,
      group: e.group,
      description: e.description || null,
      schema: typeof e.schema === 'string' ? e.schema : null,
      columns,
      constraints,
      indexes,
      x: 0,
      y: 0,
      _w: 0,
      _h: 0,
    };
    if (e.id) entityById.set(e.id, ne);
    return ne;
  });

  // Cardinality inference (below, in the relationships pass) needs each
  // endpoint's derived pk/fk role — computed from the entity's CONSTRAINTS
  // (columnRoles), never from a legacy per-field `role`. Constraints are
  // synthesized above for every entity regardless of authoring shape (legacy
  // role/ref or an explicit `constraints` array), so this works identically
  // either way — that's the whole point of the fix. Must run after
  // normEntities so every entity's constraints already exist.
  const rolesByEntity = new Map<string, Map<string, ColumnRole>>();
  for (const ne of normEntities) rolesByEntity.set(ne.id, columnRoles(ne));

  for (const lr of legacyRefs) {
    const target = entityById.get(lr.ref);
    if (!target) warnings.push(`Field "${lr.entityId}.${lr.fieldName}" ref points at unknown entity "${lr.ref}".`);
    else if (lr.refField && !target.columns.some((tf) => tf.name === lr.refField))
      warnings.push(`Field "${lr.entityId}.${lr.fieldName}" ref "${lr.ref}.${lr.refField}" — no such field.`);
  }

  // The legacy `ref` shape above gets a dangling-reference warning; the
  // canonical `constraints` shape it was replaced by never did — an fk
  // constraint's refTable/refColumns/columns were taken on faith. That
  // asymmetry let a corrupt-but-canonical file (e.g. a column rename that
  // left some OTHER table's fk constraint pointing at a name that no longer
  // exists) load with 0 warnings, silently dropping the edge (and its label)
  // for good. derive-relationships already skips any fk it can't resolve
  // (deriveConstraintEdges), so this is purely diagnostic — a WARNING, not an
  // error, mirroring the legacy check's own severity: a stale/broken fk must
  // not block the whole file from loading.
  for (const e of normEntities) {
    const ownCols = new Set(e.columns.map((c) => c.name));
    for (const c of e.constraints) {
      if (c.kind !== 'fk') continue;
      for (const col of c.columns) {
        if (!ownCols.has(col))
          warnings.push(`Entity "${e.id}" constraint "${c.id}" references unknown own column "${col}".`);
      }
      const target = entityById.get(c.refTable);
      if (!target) {
        warnings.push(`Entity "${e.id}" constraint "${c.id}" references unknown table "${c.refTable}".`);
        continue;
      }
      const targetCols = new Set(target.columns.map((tc) => tc.name));
      for (const col of c.refColumns) {
        if (!targetCols.has(col))
          warnings.push(`Entity "${e.id}" constraint "${c.id}" references unknown column "${col}" on table "${c.refTable}".`);
      }
    }
  }

  // ---- kinds ----
  const kindStyle = new Map<string, LineStyle>();
  const normKinds: EdgeKind[] = (Array.isArray(r.kinds) ? r.kinds : []).map((k: any) => {
    const style: LineStyle = k.style === 'dashed' ? 'dashed' : 'solid';
    kindStyle.set(k.id, style);
    return { id: k.id, label: k.label || k.id, style };
  });

  // ---- relationships ----
  const usedKinds = new Set<string>();
  const normRels: Relationship[] = relationships.map((rel: any, i: number) => {
    // Endpoints may be flat (source/sourceField) or objects ({ entity, field }).
    const srcEntity: string = rel.source && typeof rel.source === 'object' ? rel.source.entity : rel.source;
    const srcField: string = rel.source && typeof rel.source === 'object' ? rel.source.field : rel.sourceField;
    const tgtEntity: string = rel.target && typeof rel.target === 'object' ? rel.target.entity : rel.target;
    const tgtField: string = rel.target && typeof rel.target === 'object' ? rel.target.field : rel.targetField;
    const id: string = rel.id || `rel_${i}_${srcEntity}_${srcField}__${tgtEntity}_${tgtField}`;
    const src = entityById.get(srcEntity);
    const tgt = entityById.get(tgtEntity);
    if (!srcEntity || !src) errors.push(`Relationship "${id}" references unknown source entity "${srcEntity}".`);
    if (!tgtEntity || !tgt) errors.push(`Relationship "${id}" references unknown target entity "${tgtEntity}".`);

    const noRole: ColumnRole = { pk: false, fk: false, unique: false };
    let srcRole: ColumnRole = noRole;
    let tgtRole: ColumnRole = noRole;
    if (src) {
      const sf = src.columns.find((f) => f.name === srcField);
      if (!sf) errors.push(`Relationship "${id}" — source field "${srcEntity}.${srcField}" does not exist.`);
      else srcRole = rolesByEntity.get(srcEntity)?.get(srcField) ?? noRole;
    }
    if (tgt) {
      const tf = tgt.columns.find((f) => f.name === tgtField);
      if (!tf) errors.push(`Relationship "${id}" — target field "${tgtEntity}.${tgtField}" does not exist.`);
      else tgtRole = rolesByEntity.get(tgtEntity)?.get(tgtField) ?? noRole;
    }

    if (rel.cardinality && !CARDINALITIES.includes(rel.cardinality))
      warnings.push(`Relationship "${id}" has invalid cardinality "${rel.cardinality}".`);

    const card = inferCardinality(rel, srcRole, tgtRole);
    if (card.fallback)
      warnings.push(`Relationship "${id}" cardinality could not be inferred from roles; defaulted to "1-n".`);

    if (rel.kind) usedKinds.add(rel.kind);

    const nr: Relationship = {
      id,
      source: srcEntity,
      sourceField: srcField,
      target: tgtEntity,
      targetField: tgtField,
      cardinality: card.value,
      cardinalityInferred: card.inferred,
      kind: rel.kind || null,
      label: rel.label || null,
    };
    return nr;
  });

  for (const k of usedKinds) if (!kindStyle.has(k)) kindStyle.set(k, 'solid');

  // ---- relationships: constraints are the source of truth ----
  // normRels above is the authored/explicit list (ids + cardinality already
  // normalised); deriveRelationships folds in one edge per fk constraint,
  // dropping any explicit kind:'fk' rel in favour of its derived replacement
  // (see derive-relationships.ts) so a table's constraints can never disagree
  // with the edges drawn for it.
  const finalRelationships = deriveRelationships({
    entities: normEntities,
    entityById,
    relationships: normRels,
  } as Model);
  const relById = new Map(finalRelationships.map((r) => [r.id, r]));

  // ---- colors (id → hex overrides; zones, subgroups, or entities) ----
  const colors = new Map<string, string>();
  if (r.colors && typeof r.colors === 'object')
    for (const [k, v] of Object.entries(r.colors as Record<string, unknown>))
      if (typeof v === 'string') colors.set(k, v);

  // ---- saved layout (hand-arranged x/y and group bounds persisted in the file) ----
  const savedEntities = new Map<string, { x: number; y: number }>();
  for (const e of entities || [])
    if (typeof e.x === 'number' && typeof e.y === 'number') savedEntities.set(e.id, { x: e.x, y: e.y });
  const savedGroups = new Map<string, { x: number; y: number; w: number; h: number }>();
  for (const g of groups || [])
    if (g.bounds && ['x', 'y', 'w', 'h'].every((k) => typeof g.bounds[k] === 'number'))
      savedGroups.set(g.id, { x: g.bounds.x, y: g.bounds.y, w: g.bounds.w, h: g.bounds.h });
  const savedLayout = savedEntities.size || savedGroups.size ? { entities: savedEntities, groups: savedGroups } : undefined;

  const view = r.view || {};
  const model: Model = {
    meta: r.meta || { title: r.title, description: r.description },
    view: {
      zoom: typeof view.zoom === 'number' ? view.zoom : 1,
      routing: normalizeRouting(view.routing),
    },
    kinds: normKinds,
    kindStyle,
    colors,
    _savedLayout: savedLayout,
    groups: normGroups,
    entities: normEntities,
    entityById,
    enums,
    relationships: finalRelationships,
    relById,
    _groupBounds: [],
    _content: { w: 0, h: 0 },
  };

  return { model, errors, warnings };
}
