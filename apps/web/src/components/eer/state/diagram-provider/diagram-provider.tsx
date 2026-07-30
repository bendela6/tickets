// Owns the reducer, derives edge geometry (frozen mid-gesture, exactly like the
// legacy live redraw), and packages the imperative surface (fit/search/checks)
// that needs the latest state + viewport element.

import { useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';

import { centerOnPoint, fitView } from '../../engine/layout/fit-view';
import { visibleBounds } from '../../engine/layout/visible-bounds';
import type { Model, RoutingMode, SearchResult } from '../../engine/model/types';
import { computeEdgeGeometry, type EdgeGeometry } from '../../engine/routing/edge-geometry';
import { searchModel } from '../../engine/search/search-model';
import {
  ActionsContext,
  DispatchContext,
  GeometryContext,
  ModelContext,
  UiContext,
  ViewContext,
  ViewportRefContext,
} from '../diagram-context';
import { diagramReducer, initialDiagramState } from '../diagram-reducer';

export interface DiagramActions {
  fit(): void;
  centerOn(entityId: string): void;
  rearrange(): void; // REARRANGE + fit
  setRouting(mode: RoutingMode): void;
  setColors(colors: ReadonlyMap<string, string>): void;
  toggleGroup(id: string): void;
  toggleKind(id: string): void;
  selectEntity(id: string): void;
  selectGroup(id: string): void;
  isolate(relId: string): void;
  isolateSilent(relId: string): void;
  focusFromSearch(entityId: string, field?: string): void;
  clearSelection(): void;
  search(q: string): SearchResult[];
  load(model: Model): void; // dispatch LOAD + double-rAF fit
  repackAndFit(): void; // REPACK + fit (fonts.ready)
}

const EMPTY_GEOMETRY: EdgeGeometry = { slots: new Map(), pinSpan: new Map(), routes: new Map() };

export function DiagramProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(diagramReducer, initialDiagramState);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  // Latest state for imperative actions (search/fit/checks read outside render).
  const stateRef = useRef(state);
  stateRef.current = state;

  // Derived edge geometry — frozen while a gesture is in flight (legacy `live`
  // redraws kept slots/routes from before the drag; full recompute lands on release).
  const frozen = state.ui.gesture.kind !== 'idle';
  const lastGeometry = useRef<EdgeGeometry | null>(null);
  const geometry = useMemo(() => {
    if (!state.model) return EMPTY_GEOMETRY;
    if (frozen && lastGeometry.current) return lastGeometry.current;
    const g = computeEdgeGeometry(state.model, state.view.routing);
    lastGeometry.current = g;
    return g;
  }, [state.model, state.view.routing, frozen]);
  const geometryRef = useRef(geometry);
  geometryRef.current = geometry;

  const actions = useMemo<DiagramActions>(() => {
    const fit = () => {
      const s = stateRef.current;
      const vp = viewportRef.current;
      if (!s.model || !vp) return;
      dispatch({ type: 'SET_VIEW', view: fitView(visibleBounds(s.model, s.ui.hidden.groups), vp.clientWidth, vp.clientHeight) });
    };
    const centerOn = (entityId: string) => {
      const s = stateRef.current;
      const vp = viewportRef.current;
      const e = s.model?.entityById.get(entityId);
      if (!e || !vp) return;
      dispatch({ type: 'SET_VIEW', view: centerOnPoint(e.x + e._w / 2, e.y + e._h / 2, vp.clientWidth, vp.clientHeight, s.view.zoom) });
    };
    return {
      fit,
      centerOn,
      rearrange: () => {
        dispatch({ type: 'REARRANGE' });
        // fit() reads stateRef.current, which only reflects the just-dispatched
        // repack once React has rendered it (dispatch is async) — double-rAF defer,
        // same as load(), so we frame the freshly packed model, not the stale one.
        requestAnimationFrame(() => requestAnimationFrame(fit));
      },
      setRouting: (mode: RoutingMode) => dispatch({ type: 'SET_ROUTING', routing: mode }),
      setColors: (colors) => dispatch({ type: 'SET_COLORS', colors }),
      toggleGroup: (id) => dispatch({ type: 'TOGGLE_GROUP', id }),
      toggleKind: (id) => dispatch({ type: 'TOGGLE_KIND', id }),
      selectEntity: (id) => dispatch({ type: 'SELECT_ENTITY', id }),
      selectGroup: (id) => dispatch({ type: 'SELECT_GROUP', id }),
      isolate: (relId) => dispatch({ type: 'ISOLATE_EDGE', id: relId }),
      isolateSilent: (relId) => dispatch({ type: 'ISOLATE_EDGE', id: relId, silent: true }),
      focusFromSearch: (entityId, field) => {
        dispatch({ type: 'FOCUS_FROM_SEARCH', entityId, field });
        centerOn(entityId);
      },
      clearSelection: () => dispatch({ type: 'CLEAR_SELECTION' }),
      search: (q: string): SearchResult[] => (stateRef.current.model ? searchModel(stateRef.current.model, q) : []),
      load: (model: Model) => {
        dispatch({ type: 'LOAD', model });
        // Fit after layout settles (grid/scrollbars finalize a frame late) — legacy double-rAF.
        requestAnimationFrame(() => requestAnimationFrame(fit));
      },
      repackAndFit: () => {
        dispatch({ type: 'REPACK' });
        // Same stale-stateRef hazard as rearrange() above — defer to the freshly
        // packed model instead of fitting the pre-repack one.
        requestAnimationFrame(() => requestAnimationFrame(fit));
      },
    };
  }, []);

  // DEV handle for browser verification (replaces window.__eer = the legacy diagram class).
  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as unknown as { __eer: unknown }).__eer = {
        getState: () => stateRef.current,
        getGeometry: () => geometryRef.current,
        dispatch,
        actions,
      };
    }
  }, [actions]);

  return (
    <ModelContext.Provider value={state.model}>
      <ViewContext.Provider value={state.view}>
        <UiContext.Provider value={state.ui}>
          <GeometryContext.Provider value={geometry}>
            <DispatchContext.Provider value={dispatch}>
              <ActionsContext.Provider value={actions}>
                <ViewportRefContext.Provider value={viewportRef}>{children}</ViewportRefContext.Provider>
              </ActionsContext.Provider>
            </DispatchContext.Provider>
          </GeometryContext.Provider>
        </UiContext.Provider>
      </ViewContext.Provider>
    </ModelContext.Provider>
  );
}
