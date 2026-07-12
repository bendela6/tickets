// Build the DOM/SVG scene from the model: group boxes, edge SVG elements, and
// entity cards with per-field port dots. Positions come only from layout +
// geometry; focus/hover later only toggle classes, never coordinates.

import { drawAllEdges } from '../draw-all-edges';
import { edgeColor } from '../edge-color';
import { entityColor } from '../entity-color';
import { groupColor } from '../group-color';
import { positionEntity } from '../position-entity';
import type { EdgeEls, EngineState, Entity } from '../../model/types';

const SVG_NS = 'http://www.w3.org/2000/svg';

export function buildScene(state: EngineState): void {
  const world = state.els.world;
  world.innerHTML = '';

  const groupLayer = document.createElement('div');
  groupLayer.className = 'layer groups';
  for (const b of state.model._groupBounds) {
    const z = document.createElement('div');
    z.className = b.level > 0 ? 'zone zone-sub' : 'zone';
    z.dataset.group = b.id;
    if (b.parent) z.dataset.parent = b.parent;
    z.style.setProperty('--group-c', groupColor(state.model, b.id, state.colors));
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
    g.style.setProperty('--edge-c', edgeColor(state, rel.target));
    const hit = document.createElementNS(SVG_NS, 'path') as SVGPathElement;
    hit.setAttribute('class', 'edge-hit');
    const casing = document.createElementNS(SVG_NS, 'path') as SVGPathElement;
    casing.setAttribute('class', 'edge-casing');
    const path = document.createElementNS(SVG_NS, 'path') as SVGPathElement;
    path.setAttribute('class', 'edge-path');
    if (state.model.kindStyle.get(rel.kind ?? '') === 'dashed') path.classList.add('dashed');
    const head = document.createElementNS(SVG_NS, 'path') as SVGPathElement;
    head.setAttribute('class', 'edge-head');
    g.append(hit, casing, path, head);
    svg.appendChild(g);
    state.els.edgeEls.set(rel.id, { g, hit, casing, path, head });
  }

  const cardLayer = document.createElement('div');
  cardLayer.className = 'layer cards';
  world.appendChild(cardLayer);
  state.els.cardLayer = cardLayer;

  state.els.cards = new Map<string, HTMLElement>();
  for (const e of state.model.entities) {
    const card = buildCard(e, entityColor(state.model, e.id, state.colors));
    cardLayer.appendChild(card);
    state.els.cards.set(e.id, card);
    positionEntity(state, e.id);
  }

  drawAllEdges(state);
}

function buildCard(e: Entity, color: string): HTMLElement {
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.entity = e.id;
  card.dataset.group = e.group;
  card.style.width = e._w + 'px';
  card.style.setProperty('--entity-c', color);

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
