// Model — pure validation + normalization. No DOM. Given raw JSON it returns a
// normalized model plus arrays of errors (block rendering) and warnings (allow it).

const CARDINALITIES = ['1-1', '1-n', 'n-1', 'n-m'];

// 'curved' | 'avoid' | 'ortho'. 'orthogonal' is accepted as an alias for 'ortho'.
function normalizeRouting(v) {
  if (v === 'avoid') return 'avoid';
  if (v === 'ortho' || v === 'orthogonal') return 'ortho';
  return 'curved';
}

export function inferCardinality(rel, srcRole, tgtRole) {
  if (rel.cardinality) return { value: rel.cardinality, inferred: false };
  if (srcRole === 'pk' && tgtRole === 'fk') return { value: '1-n', inferred: true };
  if (srcRole === 'fk' && tgtRole === 'pk') return { value: 'n-1', inferred: true };
  if (srcRole === 'fk' && tgtRole === 'fk') return { value: 'n-m', inferred: true };
  return { value: '1-n', inferred: true, fallback: true };
}

export function loadModel(raw) {
  const errors = [];
  const warnings = [];

  if (!raw || typeof raw !== 'object') {
    return { model: null, errors: ['Model root must be a JSON object.'], warnings };
  }

  const groups = Array.isArray(raw.groups) ? raw.groups : null;
  const entities = Array.isArray(raw.entities) ? raw.entities : null;
  const relationships = Array.isArray(raw.relationships) ? raw.relationships : [];

  if (!groups || groups.length === 0) errors.push('Missing or empty required key: "groups".');
  if (!entities || entities.length === 0) errors.push('Missing or empty required key: "entities".');
  if (!Array.isArray(raw.relationships) && raw.relationships !== undefined)
    errors.push('"relationships" must be an array.');

  // ---- groups ----
  const groupIds = new Set();
  const normGroups = (groups || []).map((g, i) => {
    if (!g.id) errors.push(`groups[${i}] is missing "id".`);
    else if (groupIds.has(g.id)) errors.push(`Duplicate group id "${g.id}".`);
    else groupIds.add(g.id);
    return { id: g.id, label: g.label || g.id, order: g.order ?? i };
  });
  normGroups.sort((a, b) => a.order - b.order);

  // ---- entities ----
  const entityById = new Map();
  const normEntities = (entities || []).map((e, i) => {
    if (!e.id) errors.push(`entities[${i}] is missing "id".`);
    else if (entityById.has(e.id)) errors.push(`Duplicate entity id "${e.id}".`);
    if (e.group && !groupIds.has(e.group))
      errors.push(`Entity "${e.id}" references unknown group "${e.group}".`);
    if (!e.group) errors.push(`Entity "${e.id}" is missing "group".`);

    const seen = new Set();
    const fields = (Array.isArray(e.fields) ? e.fields : []).map((f, fi) => {
      if (!f.name) errors.push(`Entity "${e.id}" field[${fi}] is missing "name".`);
      else if (seen.has(f.name)) errors.push(`Entity "${e.id}" has duplicate field "${f.name}".`);
      else seen.add(f.name);
      const role = f.role === 'pk' || f.role === 'fk' ? f.role : null;
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

    const ne = {
      id: e.id,
      label: e.label || e.id,
      group: e.group,
      description: e.description || null,
      fields,
      // layout fills these:
      x: 0,
      y: 0,
      _w: 0,
      _h: 0,
    };
    if (e.id) entityById.set(e.id, ne);
    return ne;
  });

  // field.ref sanity → warnings only
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
  const kindStyle = new Map();
  const normKinds = (Array.isArray(raw.kinds) ? raw.kinds : []).map((k) => {
    const style = k.style === 'dashed' ? 'dashed' : 'solid';
    kindStyle.set(k.id, style);
    return { id: k.id, label: k.label || k.id, style };
  });

  // ---- relationships ----
  const relById = new Map();
  const usedKinds = new Set();
  const normRels = relationships.map((r, i) => {
    const id = r.id || `rel_${i}_${r.source}_${r.sourceField}__${r.target}_${r.targetField}`;
    const src = entityById.get(r.source);
    const tgt = entityById.get(r.target);
    if (!r.source || !src) errors.push(`Relationship "${id}" references unknown source entity "${r.source}".`);
    if (!r.target || !tgt) errors.push(`Relationship "${id}" references unknown target entity "${r.target}".`);

    let srcRole = null;
    let tgtRole = null;
    if (src) {
      const sf = src.fields.find((f) => f.name === r.sourceField);
      if (!sf) errors.push(`Relationship "${id}" — source field "${r.source}.${r.sourceField}" does not exist.`);
      else srcRole = sf.role;
    }
    if (tgt) {
      const tf = tgt.fields.find((f) => f.name === r.targetField);
      if (!tf) errors.push(`Relationship "${id}" — target field "${r.target}.${r.targetField}" does not exist.`);
      else tgtRole = tf.role;
    }

    if (r.cardinality && !CARDINALITIES.includes(r.cardinality))
      warnings.push(`Relationship "${id}" has invalid cardinality "${r.cardinality}".`);

    const card = inferCardinality(r, srcRole, tgtRole);
    if (card.fallback)
      warnings.push(`Relationship "${id}" cardinality could not be inferred from roles; defaulted to "1-n".`);

    if (r.kind) usedKinds.add(r.kind);

    const nr = {
      id,
      source: r.source,
      sourceField: r.sourceField,
      target: r.target,
      targetField: r.targetField,
      cardinality: card.value,
      cardinalityInferred: card.inferred,
      kind: r.kind || null,
      label: r.label || null,
    };
    relById.set(id, nr);
    return nr;
  });

  // any edge kind seen but not declared → treat as solid, note it
  for (const k of usedKinds) if (!kindStyle.has(k)) kindStyle.set(k, 'solid');

  const view = raw.view || {};
  const model = {
    meta: raw.meta || {},
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
    // layout fills these:
    _groupBounds: [],
    _content: { w: 0, h: 0 },
  };

  return { model, errors, warnings };
}
