// Model — pure validation + normalization. No DOM. Given raw JSON it returns a
// normalized model plus errors (block rendering) and warnings (allow it).

import type {
  Cardinality,
  EdgeKind,
  Entity,
  Field,
  Group,
  LineStyle,
  LoadResult,
  Model,
  Relationship,
  Role,
  RoutingMode,
} from './types';

const CARDINALITIES: Cardinality[] = ['1-1', '1-n', 'n-1', 'n-m'];

function normalizeRouting(v: unknown): RoutingMode {
  if (v === 'avoid') return 'avoid';
  if (v === 'ortho' || v === 'orthogonal') return 'ortho';
  return 'curved';
}

interface Inferred {
  value: Cardinality;
  inferred: boolean;
  fallback?: boolean;
}

export function inferCardinality(rel: { cardinality?: unknown }, srcRole: Role, tgtRole: Role): Inferred {
  if (typeof rel.cardinality === 'string' && CARDINALITIES.includes(rel.cardinality as Cardinality)) {
    return { value: rel.cardinality as Cardinality, inferred: false };
  }
  if (rel.cardinality) return { value: '1-n', inferred: false }; // present but invalid; caller warns
  if (srcRole === 'pk' && tgtRole === 'fk') return { value: '1-n', inferred: true };
  if (srcRole === 'fk' && tgtRole === 'pk') return { value: 'n-1', inferred: true };
  if (srcRole === 'fk' && tgtRole === 'fk') return { value: 'n-m', inferred: true };
  return { value: '1-n', inferred: true, fallback: true };
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
    return { id: g.id, label: g.label || g.id, order: g.order ?? i };
  });
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
      };
    });
    if (fields.length === 0) errors.push(`Entity "${e.id}" has no fields.`);

    const ne: Entity = {
      id: e.id,
      label: e.label || e.id,
      group: e.group,
      description: e.description || null,
      fields,
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
  const relById = new Map<string, Relationship>();
  const usedKinds = new Set<string>();
  const normRels: Relationship[] = relationships.map((rel: any, i: number) => {
    const id: string = rel.id || `rel_${i}_${rel.source}_${rel.sourceField}__${rel.target}_${rel.targetField}`;
    const src = entityById.get(rel.source);
    const tgt = entityById.get(rel.target);
    if (!rel.source || !src) errors.push(`Relationship "${id}" references unknown source entity "${rel.source}".`);
    if (!rel.target || !tgt) errors.push(`Relationship "${id}" references unknown target entity "${rel.target}".`);

    let srcRole: Role = null;
    let tgtRole: Role = null;
    if (src) {
      const sf = src.fields.find((f) => f.name === rel.sourceField);
      if (!sf) errors.push(`Relationship "${id}" — source field "${rel.source}.${rel.sourceField}" does not exist.`);
      else srcRole = sf.role;
    }
    if (tgt) {
      const tf = tgt.fields.find((f) => f.name === rel.targetField);
      if (!tf) errors.push(`Relationship "${id}" — target field "${rel.target}.${rel.targetField}" does not exist.`);
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
      source: rel.source,
      sourceField: rel.sourceField,
      target: rel.target,
      targetField: rel.targetField,
      cardinality: card.value,
      cardinalityInferred: card.inferred,
      kind: rel.kind || null,
      label: rel.label || null,
      _route: null,
    };
    relById.set(id, nr);
    return nr;
  });

  for (const k of usedKinds) if (!kindStyle.has(k)) kindStyle.set(k, 'solid');

  const view = r.view || {};
  const model: Model = {
    meta: r.meta || {},
    view: {
      zoom: typeof view.zoom === 'number' ? view.zoom : 1,
      routing: normalizeRouting(view.routing),
    },
    kinds: normKinds,
    kindStyle,
    groups: normGroups,
    entities: normEntities,
    entityById,
    relationships: normRels,
    relById,
    _groupBounds: [],
    _content: { w: 0, h: 0 },
  };

  return { model, errors, warnings };
}
