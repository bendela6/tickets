// Ported from the legacy imperative diagram engine's wireGlobal (now deleted, see
// git history pre-T16). The interaction state machine — pan/zoom, entity drag,
// group drag, group resize, click-select, keyboard — as a hook that dispatches
// into the reducer instead of mutating DOM.
//
// Per-gesture scratch (mode, start points, snapshots) lives in closure `let`s
// inside the effect, exactly like the legacy handler: it is transient bookkeeping,
// not render state. The latest model/view are read through refs updated each render
// (dispatch/actions are stable, so the effect attaches its listeners once).
//
// Mount contract: the effect below attaches its listeners exactly once (its deps
// are stable), on whatever `viewportRef.current` is at that first run — so the
// [data-viewport] element must already be mounted by then. Diagram guarantees this
// by rendering the viewport div unconditionally, before any model-gated content.

import { useEffect, useRef, type RefObject } from 'react';

import { entityIdsInGroup } from '../../engine/groups/entity-ids-in-group';
import { subgroupIdsOf } from '../../engine/groups/subgroup-ids-of';
import type { GroupBounds } from '../../engine/model/types';
import { useDiagramActions, useDiagramDispatch, useDiagramModelOrNull, useDiagramView } from '../../state/diagram-context';
import {
  clamp,
  clampCardToBox,
  contentBoundsOf,
  cursorFor,
  DRAG_THRESHOLD,
  edgeMaskFor,
  IN_LABEL,
  IN_PAD,
  resizeBox,
  WHEEL_K,
  ZOOM_MAX,
  ZOOM_MIN,
  type ContentBounds,
  type EdgeMask,
} from './gesture-math';

type Mode = 'pan' | 'drag' | 'group' | 'resize' | 'idle' | null;
type BoxSnap = { id: string; x: number; y: number; w: number; h: number };

export function useDiagramGestures(viewportRef: RefObject<HTMLDivElement | null>): void {
  const model = useDiagramModelOrNull();
  const view = useDiagramView();
  const dispatch = useDiagramDispatch();
  const actions = useDiagramActions();

  // Latest model/view for the imperative handlers (read outside render).
  const modelRef = useRef(model);
  modelRef.current = model;
  const viewRef = useRef(view);
  viewRef.current = view;

  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;

    // ---- per-gesture scratch (closure, not state) ----
    let mode: Mode = null;
    let start = { x: 0, y: 0 };
    let startPan = { x: 0, y: 0 };
    let startEntity = { x: 0, y: 0 };
    let dragId: string | null = null;
    let moved = false;
    let groupId: string | null = null;
    // A group drag moves its member entities and one-or-more zone boxes (a zone
    // also carries its subgroup boxes); each snapshots its start position.
    let groupEntStart: { id: string; x: number; y: number }[] = [];
    let groupBoxStart: BoxSnap[] = [];
    // A subgroup drag is confined to its parent zone (world-space limits).
    let dragLimit: { x1: number; y1: number; x2: number; y2: number } | null = null;
    // Group resize: the grabbed edge(s), start bounds, and the clamping extents.
    let resize: { mask: EdgeMask; s0: { x: number; y: number; w: number; h: number }; content: ContentBounds | null; parent: GroupBounds | null } | null =
      null;
    let hoverZone: HTMLElement | null = null;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = vp.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const v = viewRef.current;
      const z0 = v.zoom;
      const z1 = clamp(z0 * Math.exp(-e.deltaY * WHEEL_K), ZOOM_MIN, ZOOM_MAX);
      const wx = (cx - v.panX) / z0;
      const wy = (cy - v.panY) / z0;
      dispatch({ type: 'SET_VIEW', view: { zoom: z1, panX: cx - wx * z1, panY: cy - wy * z1 } });
    };

    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const card = target.closest('[data-card]') as HTMLElement | null;
      if (e.button === 1) {
        e.preventDefault();
        mode = 'pan';
        start = { x: e.clientX, y: e.clientY };
        startPan = { x: viewRef.current.panX, y: viewRef.current.panY };
      } else if (e.button === 0) {
        const zone = target.closest('[data-zone]') as HTMLElement | null;
        const m = modelRef.current;
        if (card && !target.closest('[data-side]')) {
          mode = 'drag';
          dragId = card.dataset.entity ?? null;
          const en = m?.entityById.get(dragId ?? '');
          start = { x: e.clientX, y: e.clientY };
          startEntity = { x: en?.x ?? 0, y: en?.y ?? 0 };
          moved = false;
        } else if (zone && m) {
          groupId = zone.dataset.group ?? null;
          start = { x: e.clientX, y: e.clientY };
          moved = false;
          const gb = m._groupBounds.find((b) => b.id === groupId);
          const mask = edgeMaskFor(zone, e);
          if (mask && gb && groupId) {
            // Grabbed near an edge → resize this box.
            mode = 'resize';
            resize = {
              mask,
              s0: { x: gb.x, y: gb.y, w: gb.w, h: gb.h },
              content: contentBoundsOf(m, groupId),
              parent: gb.parent ? (m._groupBounds.find((b) => b.id === gb.parent) ?? null) : null,
            };
          } else {
            mode = 'group';
            // Entities: a zone carries its subgroups' cards too; a subgroup its own.
            const entIds = groupId ? entityIdsInGroup(m, groupId) : new Set<string>();
            groupEntStart = m.entities.filter((en) => entIds.has(en.id)).map((en) => ({ id: en.id, x: en.x, y: en.y }));
            // Boxes: the grabbed box plus (for a zone) every subgroup box inside it.
            const boxIds = groupId ? [groupId, ...subgroupIdsOf(m, groupId)] : [];
            groupBoxStart = boxIds
              .map((bid) => {
                const obj = m._groupBounds.find((b) => b.id === bid);
                return obj ? { id: bid, x: obj.x, y: obj.y, w: obj.w, h: obj.h } : null;
              })
              .filter((v): v is BoxSnap => v != null);
            // A subgroup may only move within its parent zone.
            dragLimit = null;
            if (gb?.parent) {
              const p = m._groupBounds.find((b) => b.id === gb.parent);
              if (p) dragLimit = { x1: p.x + IN_PAD, y1: p.y + IN_LABEL, x2: p.x + p.w - IN_PAD, y2: p.y + p.h - IN_PAD };
            }
          }
        } else {
          mode = 'idle';
          start = { x: e.clientX, y: e.clientY };
          startPan = { x: viewRef.current.panX, y: viewRef.current.panY };
          moved = false;
        }
      }
    };

    const onMove = (e: MouseEvent) => {
      if (!mode) {
        // Idle hover: show a resize cursor near a group box edge (transient UI, not state).
        const t = e.target as HTMLElement | null;
        const zone = t && typeof t.closest === 'function' ? (t.closest('[data-zone]') as HTMLElement | null) : null;
        if (hoverZone && hoverZone !== zone) {
          delete hoverZone.dataset.resizeCursor;
          hoverZone = null;
        }
        if (zone) {
          const mask = edgeMaskFor(zone, e);
          if (mask) zone.dataset.resizeCursor = cursorFor(mask);
          else delete zone.dataset.resizeCursor;
          hoverZone = zone;
        }
        return;
      }
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      const v = viewRef.current;
      const m = modelRef.current;
      if (mode === 'pan') {
        dispatch({ type: 'SET_VIEW', view: { panX: startPan.x + dx, panY: startPan.y + dy } });
      } else if (mode === 'drag' && dragId) {
        if (Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD && !moved) {
          moved = true;
          dispatch({ type: 'SET_GESTURE', gesture: { kind: 'entity', id: dragId } });
        }
        const en = m?.entityById.get(dragId);
        if (en) {
          let x = startEntity.x + dx / v.zoom;
          let y = startEntity.y + dy / v.zoom;
          // A card stays inside its group box (min-after-max keeps left/top priority).
          const b = m!._groupBounds.find((g) => g.id === en.group);
          if (b) ({ x, y } = clampCardToBox(x, y, en, b));
          dispatch({ type: 'SET_POSITIONS', entities: [{ id: dragId, x, y }], boxes: [] });
        }
      } else if (mode === 'group') {
        if (Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD && !moved) {
          moved = true;
          dispatch({ type: 'SET_GESTURE', gesture: { kind: 'group' } });
        }
        let wdx = dx / v.zoom;
        let wdy = dy / v.zoom;
        // A subgroup is confined to its parent zone.
        const grabbed = groupBoxStart[0];
        if (dragLimit && grabbed) {
          wdx = clamp(wdx, dragLimit.x1 - grabbed.x, dragLimit.x2 - (grabbed.x + grabbed.w));
          wdy = clamp(wdy, dragLimit.y1 - grabbed.y, dragLimit.y2 - (grabbed.y + grabbed.h));
        }
        const entities = groupEntStart.map((gs) => ({ id: gs.id, x: gs.x + wdx, y: gs.y + wdy }));
        const boxes = groupBoxStart.map((gb) => ({ id: gb.id, x: gb.x + wdx, y: gb.y + wdy }));
        dispatch({ type: 'SET_POSITIONS', entities, boxes });
      } else if (mode === 'resize' && resize && groupId) {
        if (Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD && !moved) {
          moved = true;
          dispatch({ type: 'SET_GESTURE', gesture: { kind: 'resize' } });
        }
        const wdx = dx / v.zoom;
        const wdy = dy / v.zoom;
        const box = resizeBox(resize.s0, resize.mask, wdx, wdy, resize.content, resize.parent);
        dispatch({ type: 'RESIZE_GROUP', id: groupId, ...box });
      } else if (mode === 'idle') {
        if (Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD) {
          // A press that starts on empty space becomes a pan once it moves.
          moved = true;
          mode = 'pan';
          dispatch({ type: 'SET_VIEW', view: { panX: startPan.x + dx, panY: startPan.y + dy } });
        }
      }
    };

    const onUp = () => {
      if (mode === 'drag' && !moved && dragId) {
        actions.selectEntity(dragId);
      } else if (mode === 'group' && !moved && groupId) {
        actions.selectGroup(groupId);
      } else if (mode === 'resize' && !moved && groupId) {
        actions.selectGroup(groupId);
      } else if (mode === 'idle' && !moved) {
        actions.clearSelection();
      }
      // A moved entity/group/resize froze the geometry memo (SET_GESTURE); release
      // it so routes recompute — replaces the legacy engine's conditional edge redraw.
      if (moved && (mode === 'drag' || mode === 'group' || mode === 'resize')) {
        dispatch({ type: 'SET_GESTURE', gesture: { kind: 'idle' } });
      }
      mode = null;
      dragId = null;
      groupId = null;
      groupEntStart = [];
      groupBoxStart = [];
      dragLimit = null;
      resize = null;
      moved = false;
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') actions.clearSelection();
    };

    // Wheel stays a manual listener: React's synthetic wheel can't preventDefault.
    vp.addEventListener('wheel', onWheel, { passive: false });
    vp.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('keydown', onKey);
    return () => {
      vp.removeEventListener('wheel', onWheel);
      vp.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('keydown', onKey);
    };
  }, [viewportRef, dispatch, actions]);
}
