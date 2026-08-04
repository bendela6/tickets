// Slice contexts so memoized scene components only re-render for their slice.
// The provider (diagram-provider.tsx) is the only writer.

import { createContext, useContext, type RefObject } from 'react';

import type { Model } from '../engine/model/types';
import type { EdgeGeometry } from '../engine/routing/edge-geometry';
import type { DiagramAction, DiagramUi, DiagramView } from './diagram-reducer';
import type { DiagramActions } from './diagram-provider/diagram-provider';

export const ModelContext = createContext<Model | null>(null);
export const ViewContext = createContext<DiagramView | null>(null);
export const UiContext = createContext<DiagramUi | null>(null);
export const GeometryContext = createContext<EdgeGeometry | null>(null);
export const DispatchContext = createContext<((a: DiagramAction) => void) | null>(null);
export const ActionsContext = createContext<DiagramActions | null>(null);
export const ViewportRefContext = createContext<RefObject<HTMLDivElement | null> | null>(null);

function req<T>(v: T | null, name: string): T {
  if (v === null) throw new Error(name + ' used outside <DiagramProvider>');
  return v;
}

export function useDiagramModelOrNull(): Model | null {
  return useContext(ModelContext);
}
export function useDiagramModel(): Model {
  return req(useContext(ModelContext), 'useDiagramModel');
}
export function useDiagramView(): DiagramView {
  return req(useContext(ViewContext), 'useDiagramView');
}
export function useDiagramUi(): DiagramUi {
  return req(useContext(UiContext), 'useDiagramUi');
}
// Null-tolerant variants, for UI that renders in a shell OUTSIDE the diagram's
// own subtree — the app's mode panel hosts <Outline/> on /schema, and the same
// panel component is also rendered on routes where no <DiagramProvider> exists.
// Such a component reads all three and bails when any is absent, instead of
// throwing the way the strict hooks above deliberately do.
export function useDiagramUiOrNull(): DiagramUi | null {
  return useContext(UiContext);
}
export function useDiagramActionsOrNull(): DiagramActions | null {
  return useContext(ActionsContext);
}
export function useDiagramGeometry(): EdgeGeometry {
  return req(useContext(GeometryContext), 'useDiagramGeometry');
}
export function useDiagramDispatch() {
  return req(useContext(DispatchContext), 'useDiagramDispatch');
}
export function useDiagramActions(): DiagramActions {
  return req(useContext(ActionsContext), 'useDiagramActions');
}
export function useViewportRef() {
  return req(useContext(ViewportRefContext), 'useViewportRef');
}
