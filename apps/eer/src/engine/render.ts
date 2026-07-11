// Render — builds the DOM/SVG scene and owns all visual state changes (position,
// edge geometry, focus/dim classes). Positions come only from layout + geometry;
// focus/hover only toggle classes, never coordinates (no reflow, no drift).

import { edgeEndpoints, edgeSides, PORT_GAP } from './geometry';
import { computeRoutes, orthoPolyPath, polyMidpoint, simpleOrtho, smoothPath } from './routing';
import type { EdgeEls, EngineState, Entity, Point, Relationship, Side } from './types';

const SVG_NS = 'http://www.w3.org/2000/svg';

// Categorical palette (dataviz dark theme, validated against #0b0d12). Edges are
// coloured by SOURCE entity so hue follows the entity, not its position.
const EDGE_PALETTE = ['#3987e5', '#199e70', '#c98500', '#008300', '#9085e9', '#e66767', '#d55181', '#d95926'];

export function edgeColor(state: EngineState, entityId: string): string {
  const i = state.model.entities.findIndex((e) => e.id === entityId);
  return EDGE_PALETTE[(i < 0 ? 0 : i) % EDGE_PALETTE.length]!;
}

export function buildScene(state: EngineState): void {
  const world = state.els.world;
  world.innerHTML = '';

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

  const svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
  svg.setAttribute('class', 'edges');
  svg.style.width = state.model._content.w + 'px';
  svg.style.height = state.model._content.h + 'px';
  world.appendChild(svg);
  state.els.svg = svg;

  state.els.edgeEls = new Map<string, EdgeEls>();
  for (const rel of state.model.relationships) {
    const g = document.createElementNS(SVG_NS, 'g') as SVGGElement;
    g.setAttribute('class', 'edge');
    g.dataset.rel = rel.id;
    g.dataset.kind = rel.kind || '';
    g.style.setProperty('--edge-c', edgeColor(state, rel.source));
    const hit = document.createElementNS(SVG_NS, 'path') as SVGPathElement;
    hit.setAttribute('class', 'edge-hit');
    const casing = document.createElementNS(SVG_NS, 'path') as SVGPathElement;
    casing.setAttribute('class', 'edge-casing');
    const path = document.createElementNS(SVG_NS, 'path') as SVGPathElement;
    path.setAttribute('class', 'edge-path');
    if (state.model.kindStyle.get(rel.kind ?? '') === 'dashed') path.classList.add('dashed');
    const lblBg = document.createElementNS(SVG_NS, 'rect') as SVGRectElement;
    lblBg.setAttribute('class', 'edge-label-bg');
    lblBg.setAttribute('rx', '4');
    const lblT = document.createElementNS(SVG_NS, 'text') as SVGTextElement;
    lblT.setAttribute('class', 'edge-label-text');
    lblT.setAttribute('text-anchor', 'middle');
    lblT.setAttribute('dominant-baseline', 'central');
    lblT.textContent = rel.cardinality;
    g.append(hit, casing, path, lblBg, lblT);
    svg.appendChild(g);
    state.els.edgeEls.set(rel.id, { g, hit, casing, path, lblBg, lblT, labelBase: { x: 0, y: 0 } });
  }

  const cardLayer = document.createElement('div');
  cardLayer.className = 'layer cards';
  world.appendChild(cardLayer);
  state.els.cardLayer = cardLayer;

  state.els.cards = new Map<string, HTMLElement>();
  for (const e of state.model.entities) {
    const card = buildCard(e);
    cardLayer.appendChild(card);
    state.els.cards.set(e.id, card);
    positionEntity(state, e.id);
  }

  drawAllEdges(state);
}

function buildCard(e: Entity): HTMLElement {
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

export function positionEntity(state: EngineState, id: string): void {
  const e = state.model.entityById.get(id)!;
  const card = state.els.cards.get(id)!;
  card.style.transform = `translate(${e.x}px, ${e.y}px)`;
}

// ---- Edges ----

export function drawAllEdges(state: EngineState, live?: boolean): void {
  if (!live && state.view.routing !== 'curved') computeRoutes(state.model);
  for (const rel of state.model.relationships) drawEdge(state, rel, live ?? false);
  declutterLabels(state);
  markConnectedPorts(state);
}

export function drawEdgesForEntity(state: EngineState, id: string, live?: boolean): void {
  for (const rel of state.model.relationships) {
    if (rel.source === id || rel.target === id) drawEdge(state, rel, live ?? false);
  }
  declutterLabels(state);
  markConnectedPorts(state);
}

function drawEdge(state: EngineState, rel: Relationship, live: boolean): void {
  const els = state.els.edgeEls.get(rel.id);
  if (!els) return;
  const { p1, p2, s, t, self, A } = edgeEndpoints(state.model, rel);
  const mode = state.view.routing;

  let d: string;
  let labelPt: Point;
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
  els.lblT.setAttribute('x', String(labelPt.x));
  els.lblT.setAttribute('y', String(labelPt.y));
  els.lblBg.setAttribute('x', String(labelPt.x - tw / 2));
  els.lblBg.setAttribute('y', String(labelPt.y - 7.5));
  els.lblBg.setAttribute('width', String(tw));
  els.lblBg.setAttribute('height', '15');
}

function declutterLabels(state: EngineState): void {
  const items: { els: EdgeEls; x: number; y: number; w: number }[] = [];
  for (const rel of state.model.relationships) {
    const els = state.els.edgeEls.get(rel.id)!;
    if (els.g.classList.contains('hidden')) continue;
    items.push({ els, x: els.labelBase.x, y: els.labelBase.y, w: rel.cardinality.length * 6.4 + 10 });
  }
  items.sort((a, b) => a.x - b.x || a.y - b.y);
  const placed: { x: number; y: number; w: number }[] = [];
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
    it.els.lblT.setAttribute('y', String(y));
    it.els.lblBg.setAttribute('y', String(y - 7.5));
  }
}

export function markConnectedPorts(state: EngineState): void {
  for (const p of state.els.cardLayer.querySelectorAll('.port.connected')) p.classList.remove('connected');
  for (const rel of state.model.relationships) {
    const els = state.els.edgeEls.get(rel.id)!;
    if (els.g.classList.contains('hidden')) continue;
    const { s, t } = edgeSides(state.model, rel);
    portEl(state, rel.source, rel.sourceField, s)?.classList.add('connected');
    portEl(state, rel.target, rel.targetField, t)?.classList.add('connected');
  }
}

function portEl(state: EngineState, entity: string, field: string, side: Side): Element | null {
  return state.els.cardLayer.querySelector(
    `.port.${side === 'L' ? 'left' : 'right'}[data-entity="${cssEsc(entity)}"][data-field="${cssEsc(field)}"]`,
  );
}

function cssEsc(s: string): string {
  return s.replace(/["\\]/g, '\\$&');
}

function curvePath(p1: Point, p2: Point, s: Side, t: Side): string {
  const dx = Math.max(38, Math.min(170, Math.abs(p2.x - p1.x) * 0.5));
  const c1x = p1.x + (s === 'R' ? dx : -dx);
  const c2x = p2.x + (t === 'R' ? dx : -dx);
  return `M ${p1.x} ${p1.y} C ${c1x} ${p1.y} ${c2x} ${p2.y} ${p2.x} ${p2.y}`;
}

function loopPath(p1: Point, p2: Point, e: Entity): string {
  const out = e.x + e._w + PORT_GAP + 56;
  return `M ${p1.x} ${p1.y} C ${out} ${p1.y} ${out} ${p2.y} ${p2.x} ${p2.y}`;
}

// ---- Focus / hover / isolate (class toggles ONLY) ----

export function clearFocus(state: EngineState): void {
  for (const [, card] of state.els.cards) card.classList.remove('dim', 'focus', 'selected');
  for (const [, els] of state.els.edgeEls) els.g.classList.remove('dim', 'active', 'hot');
  for (const z of state.els.groupLayer.children) z.classList.remove('zone-selected', 'zone-dim');
  state.focus = null;
}

export function focusEntity(state: EngineState, id: string): void {
  const related = new Set<string>([id]);
  const relEdges = new Set<string>();
  for (const rel of state.model.relationships) {
    if (rel.source === id || rel.target === id) {
      relEdges.add(rel.id);
      related.add(rel.source);
      related.add(rel.target);
    }
  }
  applyDim(state, related, relEdges);
  state.els.cards.get(id)?.classList.add('selected');
  state.focus = { type: 'entity', id };
}

export function focusGroup(state: EngineState, groupId: string): void {
  const inGroup = new Set(state.model.entities.filter((e) => e.group === groupId).map((e) => e.id));
  const related = new Set<string>(inGroup);
  const relEdges = new Set<string>();
  for (const rel of state.model.relationships) {
    if (inGroup.has(rel.source) || inGroup.has(rel.target)) {
      relEdges.add(rel.id);
      related.add(rel.source);
      related.add(rel.target);
    }
  }
  applyDim(state, related, relEdges);
  for (const z of state.els.groupLayer.children) {
    z.classList.toggle('zone-selected', (z as HTMLElement).dataset.group === groupId);
    z.classList.toggle('zone-dim', (z as HTMLElement).dataset.group !== groupId);
  }
  state.focus = { type: 'group', id: groupId };
}

export function isolateEdge(state: EngineState, relId: string): void {
  const rel = state.model.relById.get(relId);
  if (!rel) return;
  applyDim(state, new Set([rel.source, rel.target]), new Set([relId]));
  raiseEdge(state, relId);
  state.focus = { type: 'edge', id: relId };
}

export function raiseEdge(state: EngineState, relId: string): void {
  const els = state.els.edgeEls.get(relId);
  if (els) state.els.svg.appendChild(els.g);
}

function applyDim(state: EngineState, related: Set<string>, relEdges: Set<string>): void {
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

export function highlightField(state: EngineState, entityId: string, field: string): void {
  const edges = new Set<string>();
  for (const rel of state.model.relationships) {
    if ((rel.source === entityId && rel.sourceField === field) || (rel.target === entityId && rel.targetField === field))
      edges.add(rel.id);
  }
  for (const [rid, els] of state.els.edgeEls) els.g.classList.toggle('hot', edges.has(rid));
}

export function clearFieldHighlight(state: EngineState): void {
  for (const [rid, els] of state.els.edgeEls) {
    if (state.focus && state.focus.type === 'edge' && state.focus.id === rid) continue;
    els.g.classList.remove('hot');
  }
}

// ---- Visibility (filters) ----

export function applyVisibility(state: EngineState): void {
  const hiddenGroups = state.hidden.groups;
  const hiddenKinds = state.hidden.kinds;
  for (const [id, card] of state.els.cards) {
    const e = state.model.entityById.get(id)!;
    card.classList.toggle('hidden', hiddenGroups.has(e.group));
  }
  for (const z of state.els.groupLayer.children) {
    z.classList.toggle('hidden', hiddenGroups.has((z as HTMLElement).dataset.group ?? ''));
  }
  for (const rel of state.model.relationships) {
    const els = state.els.edgeEls.get(rel.id)!;
    const A = state.model.entityById.get(rel.source)!;
    const B = state.model.entityById.get(rel.target)!;
    const hide = hiddenGroups.has(A.group) || hiddenGroups.has(B.group) || (rel.kind ? hiddenKinds.has(rel.kind) : false);
    els.g.classList.toggle('hidden', hide);
  }
  markConnectedPorts(state);
}

export function applyTransform(state: EngineState): void {
  const v = state.view;
  state.els.world.style.transform = `translate(${v.panX}px, ${v.panY}px) scale(${v.zoom})`;
}

export function setRouting(state: EngineState, routing: EngineState['view']['routing']): void {
  state.view.routing = routing;
  drawAllEdges(state);
}

// Reposition zones/cards/edges from freshly-packed coords without rebuilding DOM.
export function relayout(state: EngineState): void {
  const zones = state.els.groupLayer.children;
  state.model._groupBounds.forEach((b, i) => {
    const z = zones[i] as HTMLElement | undefined;
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
