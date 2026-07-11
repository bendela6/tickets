// Render — builds the DOM/SVG scene and owns all visual state changes (position,
// edge geometry, focus/dim classes). Positions come only from layout + geometry;
// focus/hover only toggle classes, never coordinates (no reflow, no drift).

import { PORT_GAP, edgeSides, edgeEndpoints } from './geometry.js';
import { computeRoutes, simpleOrtho, smoothPath, orthoPolyPath, polyMidpoint } from './routing.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

// Categorical palette (dataviz dark theme, validated against the #0b0d12 surface —
// lightness/chroma/contrast PASS, CVD in the floor band which is fine since colour
// is a secondary wayfinding aid here). Edges are coloured by SOURCE entity so the
// hue follows the entity, not its position, and crossing edges from different
// tables read as distinct.
const EDGE_PALETTE = ['#3987e5', '#199e70', '#c98500', '#008300', '#9085e9', '#e66767', '#d55181', '#d95926'];

export function edgeColor(state, entityId) {
  const i = state.model.entities.findIndex((e) => e.id === entityId);
  return EDGE_PALETTE[(i < 0 ? 0 : i) % EDGE_PALETTE.length];
}

export function buildScene(state) {
  const world = state.els.world;
  world.innerHTML = '';

  // --- zone layer (behind everything) ---
  const groupLayer = document.createElement('div');
  groupLayer.className = 'layer groups';
  for (const b of state.model._groupBounds) {
    const z = document.createElement('div');
    z.className = 'zone';
    z.dataset.group = b.id;
    z.style.left = b.x + 'px';
    z.style.top = b.y + 'px';
    z.style.width = b.w + 'px';
    z.style.height = b.h + 'px';
    const lbl = document.createElement('div');
    lbl.className = 'zone-label';
    lbl.textContent = b.label;
    z.appendChild(lbl);
    groupLayer.appendChild(z);
  }
  world.appendChild(groupLayer);
  state.els.groupLayer = groupLayer;

  // --- edge layer (SVG, above zones, below cards) ---
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'edges');
  svg.style.width = state.model._content.w + 'px';
  svg.style.height = state.model._content.h + 'px';
  world.appendChild(svg);
  state.els.svg = svg;

  state.els.edgeEls = new Map();
  for (const rel of state.model.relationships) {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'edge');
    g.dataset.rel = rel.id;
    g.dataset.kind = rel.kind || '';
    g.style.setProperty('--edge-c', edgeColor(state, rel.source));
    const hit = document.createElementNS(SVG_NS, 'path');
    hit.setAttribute('class', 'edge-hit');
    const casing = document.createElementNS(SVG_NS, 'path');
    casing.setAttribute('class', 'edge-casing');
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('class', 'edge-path');
    if (state.model.kindStyle.get(rel.kind) === 'dashed') path.classList.add('dashed');
    const lblBg = document.createElementNS(SVG_NS, 'rect');
    lblBg.setAttribute('class', 'edge-label-bg');
    lblBg.setAttribute('rx', '4');
    const lblT = document.createElementNS(SVG_NS, 'text');
    lblT.setAttribute('class', 'edge-label-text');
    lblT.setAttribute('text-anchor', 'middle');
    lblT.setAttribute('dominant-baseline', 'central');
    lblT.textContent = rel.cardinality;
    g.append(hit, casing, path, lblBg, lblT);
    svg.appendChild(g);
    state.els.edgeEls.set(rel.id, { g, hit, casing, path, lblBg, lblT, labelBase: { x: 0, y: 0 } });
  }

  // --- card layer ---
  const cardLayer = document.createElement('div');
  cardLayer.className = 'layer cards';
  world.appendChild(cardLayer);
  state.els.cardLayer = cardLayer;

  state.els.cards = new Map();
  for (const e of state.model.entities) {
    const card = buildCard(e);
    cardLayer.appendChild(card);
    state.els.cards.set(e.id, card);
    positionEntity(state, e.id);
  }

  drawAllEdges(state);
}

function buildCard(e) {
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.entity = e.id;
  card.dataset.group = e.group;
  card.style.width = e._w + 'px';

  const hd = document.createElement('div');
  hd.className = 'card-hd';
  const title = document.createElement('span');
  title.className = 'card-title';
  title.textContent = e.label;
  hd.appendChild(title);
  card.appendChild(hd);

  const body = document.createElement('div');
  body.className = 'card-body';
  e.fields.forEach((f, i) => {
    const row = document.createElement('div');
    row.className = 'field' + (f.role ? ' role-' + f.role : '');
    row.dataset.entity = e.id;
    row.dataset.field = f.name;
    row.dataset.index = String(i);

    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = f.role ? f.role.toUpperCase() : '';
    const fname = document.createElement('span');
    fname.className = 'fname';
    fname.textContent = f.name;
    const ftype = document.createElement('span');
    ftype.className = 'ftype';
    ftype.textContent = f.type || '';
    const portL = document.createElement('span');
    portL.className = 'port left';
    portL.dataset.entity = e.id;
    portL.dataset.field = f.name;
    portL.dataset.side = 'L';
    const portR = document.createElement('span');
    portR.className = 'port right';
    portR.dataset.entity = e.id;
    portR.dataset.field = f.name;
    portR.dataset.side = 'R';

    row.append(badge, fname, ftype, portL, portR);
    body.appendChild(row);
  });
  card.appendChild(body);
  return card;
}

export function positionEntity(state, id) {
  const e = state.model.entityById.get(id);
  const card = state.els.cards.get(id);
  card.style.transform = `translate(${e.x}px, ${e.y}px)`;
}

// ---- Edges ----

export function drawAllEdges(state, live) {
  if (!live && state.view.routing !== 'curved') computeRoutes(state);
  for (const rel of state.model.relationships) drawEdge(state, rel, live);
  declutterLabels(state);
  markConnectedPorts(state);
}

// live = true skips the (expensive) A* reroute — used mid-drag for the moved
// entity's edges; drawAllEdges reroutes properly on drop.
export function drawEdgesForEntity(state, id, live) {
  for (const rel of state.model.relationships) {
    if (rel.source === id || rel.target === id) drawEdge(state, rel, live);
  }
  declutterLabels(state);
  markConnectedPorts(state);
}

function drawEdge(state, rel, live) {
  const els = state.els.edgeEls.get(rel.id);
  if (!els) return;
  const { p1, p2, s, t, self, A } = edgeEndpoints(state.model, rel);
  const mode = state.view.routing;

  let d;
  let labelPt;
  if (self) {
    d = loopPath(p1, p2, A);
    labelPt = { x: A.x + A._w + PORT_GAP + 52, y: (p1.y + p2.y) / 2 };
  } else if (mode === 'curved') {
    d = curvePath(p1, p2, s, t);
    labelPt = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  } else {
    const pts = !live && rel._route ? rel._route : simpleOrtho(p1, p2, s, t);
    d = mode === 'ortho' ? orthoPolyPath(pts) : smoothPath(pts);
    labelPt = polyMidpoint(pts);
  }

  els.path.setAttribute('d', d);
  els.casing.setAttribute('d', d);
  els.hit.setAttribute('d', d);

  els.labelBase = labelPt;
  const tw = rel.cardinality.length * 6.4 + 10;
  els.lblT.setAttribute('x', labelPt.x);
  els.lblT.setAttribute('y', labelPt.y);
  els.lblBg.setAttribute('x', labelPt.x - tw / 2);
  els.lblBg.setAttribute('y', labelPt.y - 7.5);
  els.lblBg.setAttribute('width', tw);
  els.lblBg.setAttribute('height', 15);
}

// Nudge overlapping cardinality labels apart vertically (greedy). Labels start at
// their edge midpoint; colliding ones are pushed down so none stack.
function declutterLabels(state) {
  const items = [];
  for (const rel of state.model.relationships) {
    const els = state.els.edgeEls.get(rel.id);
    if (els.g.classList.contains('hidden')) continue;
    items.push({ els, x: els.labelBase.x, y: els.labelBase.y, w: rel.cardinality.length * 6.4 + 10 });
  }
  items.sort((a, b) => a.x - b.x || a.y - b.y);
  const placed = [];
  for (const it of items) {
    let y = it.y;
    let guard = 0;
    let moved = true;
    while (moved && guard++ < 60) {
      moved = false;
      for (const p of placed) {
        if (Math.abs(p.x - it.x) < (p.w + it.w) / 2 && Math.abs(p.y - y) < 16) {
          y = p.y + 16;
          moved = true;
        }
      }
    }
    placed.push({ x: it.x, y, w: it.w });
    it.els.lblT.setAttribute('y', y);
    it.els.lblBg.setAttribute('y', y - 7.5);
  }
}

// Emphasize ports that actually carry an edge; leave the rest subtle. Sides are
// chosen per layout, so recompute whenever edges are (re)drawn.
export function markConnectedPorts(state) {
  for (const p of state.els.cardLayer.querySelectorAll('.port.connected')) p.classList.remove('connected');
  for (const rel of state.model.relationships) {
    const els = state.els.edgeEls.get(rel.id);
    if (els.g.classList.contains('hidden')) continue;
    const { s, t } = edgeSides(state.model, rel);
    const sp = portEl(state, rel.source, rel.sourceField, s);
    const tp = portEl(state, rel.target, rel.targetField, t);
    if (sp) sp.classList.add('connected');
    if (tp) tp.classList.add('connected');
  }
}

function portEl(state, entity, field, side) {
  return state.els.cardLayer.querySelector(
    `.port.${side === 'L' ? 'left' : 'right'}[data-entity="${cssEsc(entity)}"][data-field="${cssEsc(field)}"]`
  );
}

function cssEsc(s) {
  return String(s).replace(/["\\]/g, '\\$&');
}

function curvePath(p1, p2, s, t) {
  const dx = Math.max(38, Math.min(170, Math.abs(p2.x - p1.x) * 0.5));
  const c1x = p1.x + (s === 'R' ? dx : -dx);
  const c2x = p2.x + (t === 'R' ? dx : -dx);
  return `M ${p1.x} ${p1.y} C ${c1x} ${p1.y} ${c2x} ${p2.y} ${p2.x} ${p2.y}`;
}

function loopPath(p1, p2, e) {
  const out = e.x + e._w + PORT_GAP + 56;
  return `M ${p1.x} ${p1.y} C ${out} ${p1.y} ${out} ${p2.y} ${p2.x} ${p2.y}`;
}

// ---- Focus / hover / isolate (class toggles ONLY) ----

export function clearFocus(state) {
  for (const [, card] of state.els.cards) card.classList.remove('dim', 'focus', 'selected');
  for (const [, els] of state.els.edgeEls) els.g.classList.remove('dim', 'active', 'hot');
  for (const z of state.els.groupLayer.children) z.classList.remove('zone-selected', 'zone-dim');
  state.focus = null;
}

// Activate a whole group: keep its tables + every edge touching them, fade the rest.
export function focusGroup(state, groupId) {
  const inGroup = new Set(state.model.entities.filter((e) => e.group === groupId).map((e) => e.id));
  const related = new Set(inGroup);
  const relEdges = new Set();
  for (const rel of state.model.relationships) {
    if (inGroup.has(rel.source) || inGroup.has(rel.target)) {
      relEdges.add(rel.id);
      related.add(rel.source);
      related.add(rel.target);
    }
  }
  applyDim(state, related, relEdges);
  for (const z of state.els.groupLayer.children) {
    z.classList.toggle('zone-selected', z.dataset.group === groupId);
    z.classList.toggle('zone-dim', z.dataset.group !== groupId);
  }
  state.focus = { type: 'group', id: groupId };
}

export function focusEntity(state, id) {
  const related = new Set([id]);
  const relEdges = new Set();
  for (const rel of state.model.relationships) {
    if (rel.source === id || rel.target === id) {
      relEdges.add(rel.id);
      related.add(rel.source);
      related.add(rel.target);
    }
  }
  applyDim(state, related, relEdges);
  const sel = state.els.cards.get(id);
  if (sel) sel.classList.add('selected');
  state.focus = { type: 'entity', id };
}

export function isolateEdge(state, relId) {
  const rel = state.model.relById.get(relId);
  if (!rel) return;
  applyDim(state, new Set([rel.source, rel.target]), new Set([relId]));
  raiseEdge(state, relId);
  state.focus = { type: 'edge', id: relId };
}

// Move an edge to the end of the SVG so it renders on top of the others (and its
// glow isn't clipped by neighbours' casings).
export function raiseEdge(state, relId) {
  const els = state.els.edgeEls.get(relId);
  if (els) state.els.svg.appendChild(els.g);
}

function applyDim(state, related, relEdges) {
  for (const [id, card] of state.els.cards) {
    card.classList.toggle('dim', !related.has(id));
    card.classList.toggle('focus', related.has(id));
    card.classList.remove('selected');
  }
  for (const [rid, els] of state.els.edgeEls) {
    els.g.classList.toggle('active', relEdges.has(rid));
    els.g.classList.toggle('dim', !relEdges.has(rid));
    els.g.classList.remove('hot');
  }
}

export function highlightField(state, entityId, field) {
  const edges = new Set();
  for (const rel of state.model.relationships) {
    if ((rel.source === entityId && rel.sourceField === field) || (rel.target === entityId && rel.targetField === field))
      edges.add(rel.id);
  }
  for (const [rid, els] of state.els.edgeEls) els.g.classList.toggle('hot', edges.has(rid));
}

export function clearFieldHighlight(state) {
  // only clears transient hover highlight, leaving any active focus intact
  for (const [rid, els] of state.els.edgeEls) {
    if (!state.focus || (state.focus.type === 'edge' && state.focus.id === rid)) continue;
    els.g.classList.remove('hot');
  }
  // when nothing is focused, drop all hover highlight
  if (!state.focus) for (const [, els] of state.els.edgeEls) els.g.classList.remove('hot');
}

// ---- Visibility (filters) ----

export function applyVisibility(state) {
  const hiddenGroups = state.hidden.groups;
  const hiddenKinds = state.hidden.kinds;
  for (const [id, card] of state.els.cards) {
    const e = state.model.entityById.get(id);
    card.classList.toggle('hidden', hiddenGroups.has(e.group));
  }
  for (const z of state.els.groupLayer.children) {
    z.classList.toggle('hidden', hiddenGroups.has(z.dataset.group));
  }
  for (const rel of state.model.relationships) {
    const els = state.els.edgeEls.get(rel.id);
    const A = state.model.entityById.get(rel.source);
    const B = state.model.entityById.get(rel.target);
    const hide = hiddenGroups.has(A.group) || hiddenGroups.has(B.group) || (rel.kind && hiddenKinds.has(rel.kind));
    els.g.classList.toggle('hidden', hide);
  }
  markConnectedPorts(state);
}

export function applyTransform(state) {
  const v = state.view;
  state.els.world.style.transform = `translate(${v.panX}px, ${v.panY}px) scale(${v.zoom})`;
}

export function setRouting(state, routing) {
  state.view.routing = routing;
  drawAllEdges(state);
}

// Reposition zones/cards/edges from freshly-packed model coords WITHOUT rebuilding
// the DOM, so event listeners on the layers survive. Call after packLayout().
export function relayout(state) {
  const zones = state.els.groupLayer.children;
  state.model._groupBounds.forEach((b, i) => {
    const z = zones[i];
    if (!z) return;
    z.style.left = b.x + 'px';
    z.style.top = b.y + 'px';
    z.style.width = b.w + 'px';
    z.style.height = b.h + 'px';
  });
  state.els.svg.style.width = state.model._content.w + 'px';
  state.els.svg.style.height = state.model._content.h + 'px';
  for (const e of state.model.entities) positionEntity(state, e.id);
  drawAllEdges(state);
}
