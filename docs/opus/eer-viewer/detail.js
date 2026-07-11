// Detail panel — shows the selected entity from the model (description, full
// fields, relationships). Clicking a relationship row isolates that edge.

import { isolateEdge, focusEntity } from './render.js';
import { centerOn } from './layout.js';

const esc = (s) =>
  String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function updateDetail(state) {
  const panel = state.els.detail;
  const id = state.selection;
  if (!id) {
    panel.innerHTML = emptyState();
    return;
  }
  const e = state.model.entityById.get(id);
  const group = state.model.groups.find((g) => g.id === e.group);

  const fieldRows = e.fields
    .map((f) => {
      const roleTag = f.role ? `<span class="rrole ${f.role}">${f.role.toUpperCase()}</span>` : `<span class="rrole"></span>`;
      const ref = f.ref ? ` <span class="k">→ ${esc(f.ref)}.${esc(f.refField || 'id')}</span>` : '';
      const title = f.title ? `<div class="k">${esc(f.title)}</div>` : '';
      const desc = f.description ? `<div class="k">${esc(f.description)}</div>` : '';
      return `<tr>
        <td class="f">${roleTag}${esc(f.name)}${ref}${title}${desc}</td>
        <td class="t">${esc(f.type)}</td>
      </tr>`;
    })
    .join('');

  const rels = relationshipsFor(state, id);
  const relRows = rels.length
    ? rels
        .map(
          (r) => `<div class="rel" data-rel="${esc(r.id)}">
            <span class="card-num">${esc(r.cardinality)}</span>
            <span class="mono">${esc(r.here)}</span>
            <span class="arrow">${r.dir === 'out' ? '→' : '←'}</span>
            <span class="mono">${esc(r.there)}</span>
          </div>`
        )
        .join('')
    : `<div class="empty">No relationships.</div>`;

  panel.innerHTML = `
    <h2>${esc(e.label)}</h2>
    <div class="sub">${esc(group ? group.label : e.group)} · ${e.fields.length} fields</div>
    ${e.description ? `<div class="desc">${esc(e.description)}</div>` : ''}
    <div class="section-title">Fields</div>
    <table>${fieldRows}</table>
    <div class="section-title">Relationships (${rels.length})</div>
    <div class="rels">${relRows}</div>
  `;

  panel.querySelectorAll('.rel').forEach((row) => {
    row.addEventListener('click', () => {
      const relId = row.dataset.rel;
      isolateEdge(state, relId);
      const rel = state.model.relById.get(relId);
      // bring both ends into view without moving the model
      centerOn(state, rel.source === id ? rel.target : rel.source);
    });
  });
}

export function updateDetailForEdge(state, relId) {
  const rel = state.model.relById.get(relId);
  if (!rel) return;
  const panel = state.els.detail;
  panel.innerHTML = `
    <h2>relationship</h2>
    <div class="sub">${esc(rel.kind || 'edge')} · ${esc(rel.cardinality)}</div>
    <div class="desc">
      <span class="mono">${esc(rel.source)}.${esc(rel.sourceField)}</span>
      &nbsp;→&nbsp;
      <span class="mono">${esc(rel.target)}.${esc(rel.targetField)}</span>
    </div>
    ${rel.label ? `<div class="desc">${esc(rel.label)}</div>` : ''}
    ${rel.cardinalityInferred ? `<div class="sub">cardinality inferred from field roles</div>` : ''}
    <div class="section-title">Endpoints</div>
    <div class="rel" data-goto="${esc(rel.source)}"><span class="mono">${esc(rel.source)}</span></div>
    <div class="rel" data-goto="${esc(rel.target)}"><span class="mono">${esc(rel.target)}</span></div>
  `;
  panel.querySelectorAll('[data-goto]').forEach((row) => {
    row.addEventListener('click', () => {
      state.selection = row.dataset.goto;
      centerOn(state, row.dataset.goto);
      updateDetail(state);
    });
  });
}

export function updateDetailForGroup(state, groupId) {
  const panel = state.els.detail;
  const group = state.model.groups.find((g) => g.id === groupId);
  const ents = state.model.entities.filter((e) => e.group === groupId);
  const idset = new Set(ents.map((e) => e.id));
  const rels = state.model.relationships.filter((r) => idset.has(r.source) || idset.has(r.target));
  const external = rels.filter((r) => !(idset.has(r.source) && idset.has(r.target)));
  const internal = rels.length - external.length;

  const tableRows = ents
    .map(
      (e) => `<div class="rel" data-entity="${esc(e.id)}">
        <span class="mono">${esc(e.label)}</span><span class="k">${e.fields.length} fields</span></div>`
    )
    .join('');

  const extRows = external
    .map((r) => {
      const outward = idset.has(r.source);
      const here = outward ? r.source : r.target;
      const there = outward ? `${r.target}.${r.targetField}` : `${r.source}.${r.sourceField}`;
      return `<div class="rel" data-rel="${esc(r.id)}">
        <span class="card-num">${esc(r.cardinality)}</span>
        <span class="mono">${esc(here)}</span>
        <span class="arrow">${outward ? '→' : '←'}</span>
        <span class="mono">${esc(there)}</span></div>`;
    })
    .join('');

  panel.innerHTML = `
    <h2>${esc(group ? group.label : groupId)}</h2>
    <div class="sub">zone · ${ents.length} tables · ${rels.length} relationships (${internal} internal)</div>
    <div class="section-title">Tables</div>
    <div class="rels">${tableRows}</div>
    <div class="section-title">Connections to other zones (${external.length})</div>
    <div class="rels">${external.length ? extRows : '<div class="empty">None — this zone is self-contained.</div>'}</div>
  `;

  panel.querySelectorAll('.rel[data-entity]').forEach((row) => {
    row.addEventListener('click', () => {
      const id = row.dataset.entity;
      state.selection = id;
      focusEntity(state, id);
      centerOn(state, id);
      updateDetail(state);
    });
  });
  panel.querySelectorAll('.rel[data-rel]').forEach((row) => {
    row.addEventListener('click', () => isolateEdge(state, row.dataset.rel));
  });
}

// Build directional relationship rows for one entity.
function relationshipsFor(state, id) {
  const out = [];
  for (const r of state.model.relationships) {
    if (r.source === id) {
      out.push({ id: r.id, dir: 'out', cardinality: r.cardinality, here: r.sourceField, there: `${r.target}.${r.targetField}` });
    } else if (r.target === id) {
      out.push({ id: r.id, dir: 'in', cardinality: r.cardinality, here: r.targetField, there: `${r.source}.${r.sourceField}` });
    }
  }
  return out;
}

function emptyState() {
  return `
    <h2>EER viewer</h2>
    <div class="sub">Click an entity to inspect it.</div>
    <div class="empty">
      <div class="row"><kbd>wheel</kbd> zoom toward the cursor</div>
      <div class="row"><kbd>middle-drag</kbd> pan the canvas</div>
      <div class="row"><kbd>left-drag</kbd> move an entity (or a whole zone)</div>
      <div class="row"><kbd>click</kbd> entity → focus its relationships</div>
      <div class="row"><kbd>click</kbd> a zone → show only its connections</div>
      <div class="row"><kbd>hover</kbd> a field → light its edges</div>
      <div class="row"><kbd>click</kbd> an edge → isolate that path</div>
      <div class="row"><kbd>Esc</kbd> / empty click → clear focus</div>
    </div>
  `;
}
