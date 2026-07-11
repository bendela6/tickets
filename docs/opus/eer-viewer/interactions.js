// Interactions — pan/zoom/drag/focus wiring. Navigation mutates only view state
// (pan/zoom) or an entity's own x/y on drag; focus/hover mutate only classes.

import { positionEntity, drawEdgesForEntity, drawAllEdges, focusEntity, focusGroup, clearFocus, highlightField, clearFieldHighlight, isolateEdge, raiseEdge } from './render.js';
import { updateDetail, updateDetailForEdge, updateDetailForGroup } from './detail.js';

const DRAG_THRESHOLD = 3;

export function wireInteractions(state) {
  const vp = state.els.viewport;

  // ---- wheel zoom toward cursor ----
  vp.addEventListener(
    'wheel',
    (e) => {
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
      state.applyTransform();
    },
    { passive: false }
  );

  // ---- drag / pan / click ----
  let mode = null; // 'pan' | 'drag' | 'group' | 'idle'
  let start = null;
  let startPan = null;
  let startEntity = null;
  let dragId = null;
  let moved = false;
  let groupId = null;
  let groupStart = null; // [{id, x, y}] entity positions at drag start
  let zoneEl = null;
  let zoneBounds = null; // { obj, x, y } the group's bounds box + its start position

  vp.addEventListener('mousedown', (e) => {
    const card = e.target.closest('.card');
    if (e.button === 1) {
      e.preventDefault();
      mode = 'pan';
      start = { x: e.clientX, y: e.clientY };
      startPan = { x: state.view.panX, y: state.view.panY };
    } else if (e.button === 0) {
      const zone = e.target.closest('.zone');
      if (card && !e.target.closest('.port')) {
        mode = 'drag';
        dragId = card.dataset.entity;
        const en = state.model.entityById.get(dragId);
        start = { x: e.clientX, y: e.clientY };
        startEntity = { x: en.x, y: en.y };
        moved = false;
      } else if (zone) {
        // zone: a click focuses the whole group; a drag moves every table in it
        mode = 'group';
        groupId = zone.dataset.group;
        zoneEl = zone;
        start = { x: e.clientX, y: e.clientY };
        moved = false;
        groupStart = state.model.entities
          .filter((en) => en.group === groupId)
          .map((en) => ({ id: en.id, x: en.x, y: en.y }));
        const gb = state.model._groupBounds.find((b) => b.id === groupId);
        zoneBounds = gb ? { obj: gb, x: gb.x, y: gb.y } : null;
      } else {
        // empty canvas: a click clears focus; a drag pans (bonus over middle-drag)
        mode = 'idle';
        start = { x: e.clientX, y: e.clientY };
        startPan = { x: state.view.panX, y: state.view.panY };
        moved = false;
      }
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (!mode) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (mode === 'pan') {
      state.view.panX = startPan.x + dx;
      state.view.panY = startPan.y + dy;
      state.applyTransform();
    } else if (mode === 'drag') {
      if (Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD) moved = true;
      const en = state.model.entityById.get(dragId);
      en.x = startEntity.x + dx / state.view.zoom;
      en.y = startEntity.y + dy / state.view.zoom;
      positionEntity(state, dragId);
      drawEdgesForEntity(state, dragId, true);
    } else if (mode === 'group') {
      if (Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD) moved = true;
      const wdx = dx / state.view.zoom;
      const wdy = dy / state.view.zoom;
      for (const gs of groupStart) {
        const en = state.model.entityById.get(gs.id);
        en.x = gs.x + wdx;
        en.y = gs.y + wdy;
        positionEntity(state, gs.id);
      }
      if (zoneEl && zoneBounds) {
        zoneEl.style.left = zoneBounds.x + wdx + 'px';
        zoneEl.style.top = zoneBounds.y + wdy + 'px';
        zoneBounds.obj.x = zoneBounds.x + wdx;
        zoneBounds.obj.y = zoneBounds.y + wdy;
      }
      drawAllEdges(state, true);
    } else if (mode === 'idle') {
      if (Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD) {
        moved = true;
        mode = 'pan';
        state.view.panX = startPan.x + dx;
        state.view.panY = startPan.y + dy;
        state.applyTransform();
      }
    }
  });

  window.addEventListener('mouseup', () => {
    if (mode === 'drag' && !moved) {
      // treated as a click → select + focus
      state.selection = dragId;
      focusEntity(state, dragId);
      updateDetail(state);
    } else if (mode === 'drag' && moved && state.view.routing !== 'curved') {
      // re-route around the new positions now the drag has ended
      drawAllEdges(state);
    } else if (mode === 'group' && !moved) {
      // click on a zone → activate the group, show only its connections
      state.selection = null;
      focusGroup(state, groupId);
      updateDetailForGroup(state, groupId);
    } else if (mode === 'group' && moved && state.view.routing !== 'curved') {
      drawAllEdges(state);
    } else if (mode === 'idle' && !moved) {
      clearFocus(state);
      state.selection = null;
      updateDetail(state);
    }
    mode = null;
    dragId = null;
    groupId = null;
    zoneEl = null;
  });

  // ---- field hover → highlight its edges (no reflow) ----
  state.els.cardLayer.addEventListener('mouseover', (e) => {
    const row = e.target.closest('.field');
    if (row) {
      highlightField(state, row.dataset.entity, row.dataset.field);
      row.classList.add('hot');
    }
  });
  state.els.cardLayer.addEventListener('mouseout', (e) => {
    const row = e.target.closest('.field');
    if (row) {
      row.classList.remove('hot');
      clearFieldHighlight(state);
    }
  });

  // ---- edge hover + click ----
  state.els.svg.addEventListener('mouseover', (e) => {
    const g = e.target.closest('.edge');
    if (g && !g.classList.contains('dim')) {
      g.classList.add('hot');
      raiseEdge(state, g.dataset.rel);
    }
  });
  state.els.svg.addEventListener('mouseout', (e) => {
    const g = e.target.closest('.edge');
    if (g && !(state.focus && state.focus.type === 'edge' && state.focus.id === g.dataset.rel)) g.classList.remove('hot');
  });
  state.els.svg.addEventListener('click', (e) => {
    const g = e.target.closest('.edge');
    if (g) {
      isolateEdge(state, g.dataset.rel);
      state.selection = null;
      updateDetailForEdge(state, g.dataset.rel);
    }
  });

  // ---- keyboard ----
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      clearFocus(state);
      state.selection = null;
      updateDetail(state);
      if (state.els.search) {
        state.els.search.value = '';
        state.els.searchResults.classList.remove('open');
      }
    }
  });
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
