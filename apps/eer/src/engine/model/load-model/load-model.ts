// Model loading — pure validation + normalization. No DOM. Given raw JSON it
// returns a normalized model plus errors (block rendering) and warnings (allow it).

import { deriveRelationships } from '../derive-relationships';
import { CARDINALITIES, inferCardinality } from '../infer-cardinality';
import type {
  Constraint,
  EdgeKind,
  Entity,
  Field,
  FkAction,
  Group,
  LineStyle,
  LoadResult,
  Model,
  Relationship,
  Role,
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
      refTable: typeof c.refTable === 'string' ? c.refTable : '',
      refColumns, onDelete: fkAction(c.onDelete), onUpdate: fkAction(c.onUpdate),
    };
  }
  if (c.kind === 'unique') return { id, kind: 'unique', name, columns };
  return { id, kind: 'pk', name, columns };
}

// Legacy files describe keys with per-field roles. One PK from every role:'pk'
// field, and one FK per field carrying a ref — regardless of role, because a
// shared-primary-key reference is role 'pk' AND a ref.
function synthesizeLegacyConstraints(fields: Field[]): Constraint[] {
  const out: Constraint[] = [];
  const pkCols = fields.filter((f) => f.role === 'pk').map((f) => f.name);
  let n = 1;
  if (pkCols.length) out.push({ id: 'c' + n++, kind: 'pk', name: null, columns: pkCols });
  for (const f of fields) {
    if (!f.ref) continue;
    out.push({
      id: 'c' + n++, kind: 'fk', name: null, columns: [f.name],
      refTable: f.ref, refColumns: [f.refField ?? 'id'], onDelete: null, onUpdate: null,
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

  // ---- entities ----
  const entityById = new Map<string, Entity>();
  const normEntities: Entity[] = (entities || []).map((e: any) => {
    if (!e.id) errors.push(`entities[?] is missing "id".`);
    else if (entityById.has(e.id)) errors.push(`Duplicate entity id "${e.id}".`);
    if (e.group && !groupIds.has(e.group)) errors.push(`Entity "${e.id}" references unknown group "${e.group}".`);
    if (!e.group) errors.push(`Entity "${e.id}" is missing "group".`);

    const seen = new Set<string>();
    const fields: Field[] = (Array.isArray(e.fields) ? e.fields : []).map((f: any, fi: number) => {
      if (!f.name) errors.push(`Entity "${e.id}" field[${fi}] is missing "name".`);
      else if (seen.has(f.name)) errors.push(`Entity "${e.id}" has duplicate field "${f.name}".`);
      else seen.add(f.name);
      const role: Role = f.role === 'pk' || f.role === 'fk' ? f.role : null;
      return {
        name: f.name,
        type: f.type || '',
        role,
        ref: f.ref || null,
        refField: f.refField || null,
        title: f.title || null,
        description: f.description || null,
        nullable: f.nullable !== false,
        default: typeof f.default === 'string' ? f.default : null,
      };
    });
    if (fields.length === 0) errors.push(`Entity "${e.id}" has no fields.`);

    const rawConstraints = Array.isArray(e.constraints) ? e.constraints : null;
    const constraints: Constraint[] = rawConstraints
      ? rawConstraints.map((c: any, ci: number) => normalizeConstraint(c, ci, e.id, errors))
      : synthesizeLegacyConstraints(fields);
    const indexes: TableIndex[] = (Array.isArray(e.indexes) ? e.indexes : []).map((ix: any, ii: number) => ({
      id: typeof ix.id === 'string' && ix.id ? ix.id : 'i' + (ii + 1),
      name: typeof ix.name === 'string' ? ix.name : '',
      columns: Array.isArray(ix.columns) ? ix.columns.filter((c: unknown) => typeof c === 'string') : [],
      unique: ix.unique === true,
    }));

    const ne: Entity = {
      id: e.id,
      label: e.label || e.id,
      group: e.group,
      description: e.description || null,
      fields,
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

  for (const e of normEntities) {
    for (const f of e.fields) {
      if (!f.ref) continue;
      const target = entityById.get(f.ref);
      if (!target) warnings.push(`Field "${e.id}.${f.name}" ref points at unknown entity "${f.ref}".`);
      else if (f.refField && !target.fields.some((tf) => tf.name === f.refField))
        warnings.push(`Field "${e.id}.${f.name}" ref "${f.ref}.${f.refField}" — no such field.`);
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

    let srcRole: Role = null;
    let tgtRole: Role = null;
    if (src) {
      const sf = src.fields.find((f) => f.name === srcField);
      if (!sf) errors.push(`Relationship "${id}" — source field "${srcEntity}.${srcField}" does not exist.`);
      else srcRole = sf.role;
    }
    if (tgt) {
      const tf = tgt.fields.find((f) => f.name === tgtField);
      if (!tf) errors.push(`Relationship "${id}" — target field "${tgtEntity}.${tgtField}" does not exist.`);
      else tgtRole = tf.role;
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
    relationships: finalRelationships,
    relById,
    _groupBounds: [],
    _content: { w: 0, h: 0 },
  };

  return { model, errors, warnings };
}
