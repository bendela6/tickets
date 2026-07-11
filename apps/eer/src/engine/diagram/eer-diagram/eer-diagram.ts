// EerDiagram — the imperative diagram engine. Owns the canvas DOM/SVG and every
// interaction (pan/zoom/drag/group/focus/routing/checks). React hosts it via a ref
// and subscribes to onSelect to drive the detail panel; it never touches this DOM.

import { applyTransform } from '../../render/apply-transform';
import { applyVisibility } from '../../focus/apply-visibility';
import { buildScene } from '../../render/build-scene';
import { clearFieldHighlight } from '../../focus/clear-field-highlight';
import { clearFocus } from '../../focus/clear-focus';
import { drawAllEdges } from '../../render/draw-all-edges';
import { drawEdgesForEntity } from '../../render/draw-edges-for-entity';
import { entityIdsInGroup } from '../../groups/entity-ids-in-group';
import { focusEntity } from '../../focus/focus-entity';
import { focusGroup } from '../../focus/focus-group';
import { highlightField } from '../../focus/highlight-field';
import { isolateEdge } from '../../focus/isolate-edge';
import { packLayout } from '../../layout/pack-layout';
import { positionEntity } from '../../render/position-entity';
import { raiseEdge } from '../../focus/raise-edge';
import { relayout } from '../../render/relayout';
import { runChecks } from '../../checks/run-checks';
import { setRouting } from '../../render/set-routing';
import { subgroupIdsOf } from '../../groups/subgroup-ids-of';
import { visibleBounds } from '../../layout/visible-bounds';
import type { CheckResult, EngineState, GroupBounds, Model, RoutingMode, SearchResult, Selection } from '../../model/types';

const SVG_NS = 'http://www.w3.org/2000/svg';
const DRAG_THRESHOLD = 3;
const RESIZE_EDGE = 8; // screen px: grab distance from a group edge to resize it
const IN_PAD = 8; // world px: children keep this inset inside their group box
const IN_LABEL = 30; // world px: children stay below the group label

interface EdgeMask {
  l: boolean;
  r: boolean;
  t: boolean;
  b: boolean;
}

function edgeMaskFor(el: HTMLElement, e: MouseEvent): EdgeMask | null {
  const r = el.getBoundingClientRect();
  const m: EdgeMask = {
    l: e.clientX - r.left <= RESIZE_EDGE,
    r: r.right - e.clientX <= RESIZE_EDGE,
    t: e.clientY - r.top <= RESIZE_EDGE,
    b: r.bottom - e.clientY <= RESIZE_EDGE,
  };
  return m.l || m.r || m.t || m.b ? m : null;
}

function cursorFor(m: EdgeMask): string {
  if ((m.l && m.t) || (m.r && m.b)) return 'nwse-resize';
  if ((m.r && m.t) || (m.l && m.b)) return 'nesw-resize';
  if (m.l || m.r) return 'ew-resize';
  return 'ns-resize';
}

export interface DiagramOptions {
  onSelect?: (selection: Selection) => void;
}

function emptyModel(): Model {
  return {
    meta: {},
    view: { zoom: 1, routing: 'curved' },
    kinds: [],
    kindStyle: new Map(),
    groups: [],
    entities: [],
    entityById: new Map(),
    relationships: [],
    relById: new Map(),
    _groupBounds: [],
    _content: { w: 0, h: 0 },
  };
}

export class EerDiagram {
  private state: EngineState;
  private opts: DiagramOptions;
  private disposers: (() => void)[] = [];
  private sceneDisposers: (() => void)[] = [];
  private destroyed = false;

  constructor(viewport: HTMLElement, mount: HTMLElement, opts: DiagramOptions = {}) {
    this.opts = opts;
    const world = document.createElement('div');
    world.className = 'world';
    mount.appendChild(world);

    this.state = {
      model: emptyModel(),
      view: { zoom: 1, panX: 0, panY: 0, routing: 'curved' },
      els: {
        viewport,
        world,
        groupLayer: document.createElement('div'),
        svg: document.createElementNS(SVG_NS, 'svg') as SVGSVGElement,
        cardLayer: document.createElement('div'),
        cards: new Map(),
        edgeEls: new Map(),
      },
      selection: null,
      focus: null,
      hidden: { groups: new Set(), kinds: new Set() },
      applyTransform: () => {},
    };
    this.state.applyTransform = () => applyTransform(this.state);
    this.wireGlobal();
  }

  get model(): Model {
    return this.state.model;
  }

  getRouting(): RoutingMode {
    return this.state.view.routing;
  }

  load(model: Model): void {
    this.state.model = model;
    this.state.view = { zoom: 1, panX: 0, panY: 0, routing: model.view.routing };
    this.state.selection = null;
    this.state.focus = null;
    this.state.hidden = { groups: new Set(), kinds: new Set() };
    packLayout(model);
    buildScene(this.state);
    this.wireScene();
    // Fit after layout has settled (grid/scrollbars finalize a frame late).
    requestAnimationFrame(() => requestAnimationFrame(() => this.fit()));
    // The first pack can run before webfonts load, so text is measured with
    // fallback metrics. Re-pack once fonts are ready so card widths are correct.
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (fonts?.ready) {
      void fonts.ready.then(() => {
        if (this.destroyed || this.state.model !== model) return;
        packLayout(model);
        relayout(this.state);
        this.fit();
      });
    }
  }

  // ---- public actions ----

  setRouting(mode: RoutingMode): void {
    setRouting(this.state, mode);
  }

  fit(): void {
    const b = visibleBounds(this.state.model, this.state.hidden.groups);
    const vp = this.state.els.viewport;
    const vw = vp.clientWidth;
    const vh = vp.clientHeight;
    const pad = 56;
    const bw = b.maxX - b.minX + pad * 2;
    const bh = b.maxY - b.minY + pad * 2;
    const zoom = Math.max(0.15, Math.min(vw / bw, vh / bh, 1.6));
    this.state.view.zoom = zoom;
    this.state.view.panX = (vw - bw * zoom) / 2 - (b.minX - pad) * zoom;
    this.state.view.panY = (vh - bh * zoom) / 2 - (b.minY - pad) * zoom;
    applyTransform(this.state);
  }

  rearrange(): void {
    clearFocus(this.state);
    this.emit();
    packLayout(this.state.model);
    relayout(this.state);
    this.fit();
  }

  centerOn(id: string): void {
    const e = this.state.model.entityById.get(id);
    if (!e) return;
    const vp = this.state.els.viewport;
    const cx = e.x + e._w / 2;
    const cy = e.y + e._h / 2;
    this.state.view.panX = vp.clientWidth / 2 - cx * this.state.view.zoom;
    this.state.view.panY = vp.clientHeight / 2 - cy * this.state.view.zoom;
    applyTransform(this.state);
  }

  setGroupHidden(id: string, hidden: boolean): void {
    if (hidden) this.state.hidden.groups.add(id);
    else this.state.hidden.groups.delete(id);
    applyVisibility(this.state);
  }

  setKindHidden(id: string, hidden: boolean): void {
    if (hidden) this.state.hidden.kinds.add(id);
    else this.state.hidden.kinds.delete(id);
    applyVisibility(this.state);
  }

  selectEntity(id: string): void {
    this.state.selection = id;
    focusEntity(this.state, id);
    this.emit();
  }

  selectGroup(id: string): void {
    this.state.selection = null;
    focusGroup(this.state, id);
    this.emit();
  }

  isolate(relId: string): void {
    this.state.selection = null;
    isolateEdge(this.state, relId);
    this.emit();
  }

  // Isolate an edge on the canvas without changing the panel selection (used by
  // detail-panel rows so the panel stays on the entity/group being inspected).
  isolateSilent(relId: string): void {
    isolateEdge(this.state, relId);
  }

  focusFromSearch(entityId: string, field?: string): void {
    this.state.selection = entityId;
    focusEntity(this.state, entityId);
    this.centerOn(entityId);
    if (field) highlightField(this.state, entityId, field);
    else clearFieldHighlight(this.state);
    this.emit();
  }

  clearSelection(): void {
    clearFocus(this.state);
    this.state.selection = null;
    this.emit();
  }

  runChecks(): CheckResult[] {
    return runChecks(this.state);
  }

  search(q: string): SearchResult[] {
    const query = q.trim().toLowerCase();
    if (!query) return [];
    const idx: SearchResult[] = [];
    for (const e of this.state.model.entities) {
      idx.push({ kind: 'entity', label: e.label, entityId: e.id, entityLabel: e.label, search: (e.label + ' ' + e.id).toLowerCase() });
      for (const f of e.fields) {
        idx.push({
          kind: 'field',
          label: f.name,
          field: f.name,
          entityId: e.id,
          entityLabel: e.label,
          search: (f.name + ' ' + e.label).toLowerCase(),
        });
      }
    }
    return idx.filter((m) => m.search.includes(query)).slice(0, 20);
  }

  destroy(): void {
    this.destroyed = true;
    for (const d of this.sceneDisposers) d();
    for (const d of this.disposers) d();
    this.sceneDisposers = [];
    this.disposers = [];
    this.state.els.world.remove(); // idempotent across StrictMode remounts
  }

  // ---- events ----

  private emit(): void {
    if (!this.opts.onSelect) return;
    const s = this.state;
    let sel: Selection;
    if (s.selection) sel = { type: 'entity', id: s.selection };
    else if (s.focus?.type === 'group') sel = { type: 'group', id: s.focus.id };
    else if (s.focus?.type === 'edge') sel = { type: 'edge', id: s.focus.id };
    else sel = { type: 'none' };
    this.opts.onSelect(sel);
  }

  // ---- interactions ----

  private wireGlobal(): void {
    const state = this.state;
    const vp = state.els.viewport;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = vp.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const z0 = state.view.zoom;
      const z1 = clamp(z0 * Math.exp(-e.deltaY * 0.0015), 0.15, 3);
      const wx = (cx - state.view.panX) / z0;
      const wy = (cy - state.view.panY) / z0;
      state.view.zoom = z1;
      state.view.panX = cx - wx * z1;
      state.view.panY = cy - wy * z1;
      applyTransform(state);
    };
    vp.addEventListener('wheel', onWheel, { passive: false });

    let mode: 'pan' | 'drag' | 'group' | 'resize' | 'idle' | null = null;
    let start = { x: 0, y: 0 };
    let startPan = { x: 0, y: 0 };
    let startEntity = { x: 0, y: 0 };
    let dragId: string | null = null;
    let moved = false;
    let groupId: string | null = null;
    // A group drag moves its entities and one-or-more zone boxes (a zone also
    // carries its subgroup boxes); each snapshots its start position.
    let groupEntStart: { id: string; x: number; y: number }[] = [];
    let groupBoxStart: { el: HTMLElement; obj: GroupBounds; x: number; y: number }[] = [];
    // A subgroup drag is confined to its parent zone (world-space limits).
    let dragLimit: { x1: number; y1: number; x2: number; y2: number } | null = null;
    // Group resize: the grabbed edge(s), start bounds, and the clamping extents.
    let resize: {
      el: HTMLElement;
      obj: GroupBounds;
      mask: EdgeMask;
      s0: { x: number; y: number; w: number; h: number };
      content: { minX: number; minY: number; maxX: number; maxY: number } | null;
      parent: GroupBounds | null;
    } | null = null;
    let hoverZone: HTMLElement | null = null;

    // Union of a group's children (cards, and subgroup boxes for a zone) — the
    // box may never be resized smaller than this.
    const contentBoundsOf = (gid: string) => {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const id of entityIdsInGroup(state.model, gid)) {
        const en = state.model.entityById.get(id)!;
        minX = Math.min(minX, en.x);
        minY = Math.min(minY, en.y);
        maxX = Math.max(maxX, en.x + en._w);
        maxY = Math.max(maxY, en.y + en._h);
      }
      for (const sb of state.model._groupBounds) {
        if (sb.parent !== gid) continue;
        minX = Math.min(minX, sb.x);
        minY = Math.min(minY, sb.y);
        maxX = Math.max(maxX, sb.x + sb.w);
        maxY = Math.max(maxY, sb.y + sb.h);
      }
      return isFinite(minX) ? { minX, minY, maxX, maxY } : null;
    };

    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const card = target.closest('.card') as HTMLElement | null;
      if (e.button === 1) {
        e.preventDefault();
        mode = 'pan';
        start = { x: e.clientX, y: e.clientY };
        startPan = { x: state.view.panX, y: state.view.panY };
      } else if (e.button === 0) {
        const zone = target.closest('.zone') as HTMLElement | null;
        if (card && !target.closest('.port')) {
          mode = 'drag';
          dragId = card.dataset.entity ?? null;
          const en = state.model.entityById.get(dragId ?? '');
          start = { x: e.clientX, y: e.clientY };
          startEntity = { x: en?.x ?? 0, y: en?.y ?? 0 };
          moved = false;
        } else if (zone) {
          groupId = zone.dataset.group ?? null;
          start = { x: e.clientX, y: e.clientY };
          moved = false;
          const gb = state.model._groupBounds.find((b) => b.id === groupId);
          const mask = edgeMaskFor(zone, e);
          if (mask && gb && groupId) {
            // Grabbed near an edge → resize this box.
            mode = 'resize';
            resize = {
              el: zone,
              obj: gb,
              mask,
              s0: { x: gb.x, y: gb.y, w: gb.w, h: gb.h },
              content: contentBoundsOf(groupId),
              parent: gb.parent ? (state.model._groupBounds.find((b) => b.id === gb.parent) ?? null) : null,
            };
          } else {
            mode = 'group';
            // Entities: a zone carries its subgroups' cards too; a subgroup its own.
            const entIds = groupId ? entityIdsInGroup(state.model, groupId) : new Set<string>();
            groupEntStart = state.model.entities
              .filter((en) => entIds.has(en.id))
              .map((en) => ({ id: en.id, x: en.x, y: en.y }));
            // Boxes: the grabbed box plus (for a zone) every subgroup box inside it.
            const boxIds = groupId ? [groupId, ...subgroupIdsOf(state.model, groupId)] : [];
            groupBoxStart = boxIds
              .map((bid) => {
                const obj = state.model._groupBounds.find((b) => b.id === bid);
                const el = [...state.els.groupLayer.children].find(
                  (c) => (c as HTMLElement).dataset.group === bid,
                ) as HTMLElement | undefined;
                return obj && el ? { el, obj, x: obj.x, y: obj.y } : null;
              })
              .filter((v): v is { el: HTMLElement; obj: GroupBounds; x: number; y: number } => v != null);
            // A subgroup may only move within its parent zone.
            dragLimit = null;
            if (gb?.parent) {
              const p = state.model._groupBounds.find((b) => b.id === gb.parent);
              if (p) dragLimit = { x1: p.x + IN_PAD, y1: p.y + IN_LABEL, x2: p.x + p.w - IN_PAD, y2: p.y + p.h - IN_PAD };
            }
          }
        } else {
          mode = 'idle';
          start = { x: e.clientX, y: e.clientY };
          startPan = { x: state.view.panX, y: state.view.panY };
          moved = false;
        }
      }
    };
    vp.addEventListener('mousedown', onDown);

    const onMove = (e: MouseEvent) => {
      if (!mode) {
        // Idle hover: show a resize cursor near a group box edge.
        const t = e.target as HTMLElement | null;
        const zone = t && typeof t.closest === 'function' ? (t.closest('.zone') as HTMLElement | null) : null;
        if (hoverZone && hoverZone !== zone) {
          hoverZone.style.cursor = '';
          hoverZone = null;
        }
        if (zone) {
          const mask = edgeMaskFor(zone, e);
          zone.style.cursor = mask ? cursorFor(mask) : '';
          hoverZone = zone;
        }
        return;
      }
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (mode === 'pan') {
        state.view.panX = startPan.x + dx;
        state.view.panY = startPan.y + dy;
        applyTransform(state);
      } else if (mode === 'drag' && dragId) {
        if (Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD) moved = true;
        const en = state.model.entityById.get(dragId);
        if (en) {
          en.x = startEntity.x + dx / state.view.zoom;
          en.y = startEntity.y + dy / state.view.zoom;
          // A card stays inside its group box (min-after-max keeps left/top priority).
          const b = state.model._groupBounds.find((g) => g.id === en.group);
          if (b) {
            en.x = Math.max(Math.min(en.x, b.x + b.w - IN_PAD - en._w), b.x + IN_PAD);
            en.y = Math.max(Math.min(en.y, b.y + b.h - IN_PAD - en._h), b.y + IN_LABEL);
          }
          positionEntity(state, dragId);
          drawEdgesForEntity(state, dragId, true);
        }
      } else if (mode === 'group') {
        if (Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD) moved = true;
        let wdx = dx / state.view.zoom;
        let wdy = dy / state.view.zoom;
        // A subgroup is confined to its parent zone.
        const grabbed = groupBoxStart[0];
        if (dragLimit && grabbed) {
          wdx = Math.max(Math.min(wdx, dragLimit.x2 - (grabbed.x + grabbed.obj.w)), dragLimit.x1 - grabbed.x);
          wdy = Math.max(Math.min(wdy, dragLimit.y2 - (grabbed.y + grabbed.obj.h)), dragLimit.y1 - grabbed.y);
        }
        for (const gs of groupEntStart) {
          const en = state.model.entityById.get(gs.id);
          if (!en) continue;
          en.x = gs.x + wdx;
          en.y = gs.y + wdy;
          positionEntity(state, gs.id);
        }
        for (const gb of groupBoxStart) {
          gb.el.style.left = gb.x + wdx + 'px';
          gb.el.style.top = gb.y + wdy + 'px';
          gb.obj.x = gb.x + wdx;
          gb.obj.y = gb.y + wdy;
        }
        drawAllEdges(state, true);
      } else if (mode === 'resize' && resize) {
        if (Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD) moved = true;
        const wdx = dx / state.view.zoom;
        const wdy = dy / state.view.zoom;
        const { s0, mask, content, parent, obj, el } = resize;
        let x1 = s0.x + (mask.l ? wdx : 0);
        let y1 = s0.y + (mask.t ? wdy : 0);
        let x2 = s0.x + s0.w + (mask.r ? wdx : 0);
        let y2 = s0.y + s0.h + (mask.b ? wdy : 0);
        // Never cut children off.
        if (content) {
          if (mask.l) x1 = Math.min(x1, content.minX - IN_PAD);
          if (mask.t) y1 = Math.min(y1, content.minY - IN_LABEL);
          if (mask.r) x2 = Math.max(x2, content.maxX + IN_PAD);
          if (mask.b) y2 = Math.max(y2, content.maxY + IN_PAD);
        }
        // A subgroup box stays inside its parent zone.
        if (parent) {
          if (mask.l) x1 = Math.max(x1, parent.x + IN_PAD);
          if (mask.t) y1 = Math.max(y1, parent.y + IN_LABEL);
          if (mask.r) x2 = Math.min(x2, parent.x + parent.w - IN_PAD);
          if (mask.b) y2 = Math.min(y2, parent.y + parent.h - IN_PAD);
        }
        // Minimum usable size.
        if (x2 - x1 < 140) mask.l ? (x1 = x2 - 140) : (x2 = x1 + 140);
        if (y2 - y1 < 80) mask.t ? (y1 = y2 - 80) : (y2 = y1 + 80);
        obj.x = x1;
        obj.y = y1;
        obj.w = x2 - x1;
        obj.h = y2 - y1;
        el.style.left = x1 + 'px';
        el.style.top = y1 + 'px';
        el.style.width = x2 - x1 + 'px';
        el.style.height = y2 - y1 + 'px';
      } else if (mode === 'idle') {
        if (Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD) {
          moved = true;
          mode = 'pan';
          state.view.panX = startPan.x + dx;
          state.view.panY = startPan.y + dy;
          applyTransform(state);
        }
      }
    };
    window.addEventListener('mousemove', onMove);

    const onUp = () => {
      if (mode === 'drag' && !moved && dragId) {
        this.selectEntity(dragId);
      } else if (mode === 'drag' && moved && state.view.routing !== 'curved') {
        drawAllEdges(state);
      } else if (mode === 'group' && !moved && groupId) {
        this.selectGroup(groupId);
      } else if (mode === 'group' && moved && state.view.routing !== 'curved') {
        drawAllEdges(state);
      } else if (mode === 'resize') {
        // Group boxes are routing obstacles — reroute around the new bounds.
        if (moved) drawAllEdges(state);
        else if (groupId) this.selectGroup(groupId);
      } else if (mode === 'idle' && !moved) {
        this.clearSelection();
      }
      mode = null;
      dragId = null;
      groupId = null;
      groupEntStart = [];
      groupBoxStart = [];
      dragLimit = null;
      resize = null;
    };
    window.addEventListener('mouseup', onUp);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') this.clearSelection();
    };
    window.addEventListener('keydown', onKey);

    this.disposers.push(
      () => vp.removeEventListener('wheel', onWheel),
      () => vp.removeEventListener('mousedown', onDown),
      () => window.removeEventListener('mousemove', onMove),
      () => window.removeEventListener('mouseup', onUp),
      () => window.removeEventListener('keydown', onKey),
    );
  }

  // Scene listeners live on the rebuilt cardLayer/svg, so re-attach each load.
  private wireScene(): void {
    for (const d of this.sceneDisposers) d();
    this.sceneDisposers = [];
    const state = this.state;

    const onCardOver = (e: Event) => {
      const row = (e.target as HTMLElement).closest('.field') as HTMLElement | null;
      if (row) {
        highlightField(state, row.dataset.entity ?? '', row.dataset.field ?? '');
        row.classList.add('hot');
      }
    };
    const onCardOut = (e: Event) => {
      const row = (e.target as HTMLElement).closest('.field') as HTMLElement | null;
      if (row) {
        row.classList.remove('hot');
        clearFieldHighlight(state);
      }
    };
    state.els.cardLayer.addEventListener('mouseover', onCardOver);
    state.els.cardLayer.addEventListener('mouseout', onCardOut);

    const onEdgeOver = (e: Event) => {
      const g = (e.target as HTMLElement).closest('.edge') as SVGGElement | null;
      if (g && !g.classList.contains('dim')) {
        g.classList.add('hot');
        raiseEdge(state, g.dataset.rel ?? '');
      }
    };
    const onEdgeOut = (e: Event) => {
      const g = (e.target as HTMLElement).closest('.edge') as SVGGElement | null;
      if (g && !(state.focus?.type === 'edge' && state.focus.id === g.dataset.rel)) g.classList.remove('hot');
    };
    const onEdgeClick = (e: Event) => {
      const g = (e.target as HTMLElement).closest('.edge') as SVGGElement | null;
      if (g && g.dataset.rel) this.isolate(g.dataset.rel);
    };
    state.els.svg.addEventListener('mouseover', onEdgeOver);
    state.els.svg.addEventListener('mouseout', onEdgeOut);
    state.els.svg.addEventListener('click', onEdgeClick);

    this.sceneDisposers.push(
      () => state.els.cardLayer.removeEventListener('mouseover', onCardOver),
      () => state.els.cardLayer.removeEventListener('mouseout', onCardOut),
      () => state.els.svg.removeEventListener('mouseover', onEdgeOver),
      () => state.els.svg.removeEventListener('mouseout', onEdgeOut),
      () => state.els.svg.removeEventListener('click', onEdgeClick),
    );
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
