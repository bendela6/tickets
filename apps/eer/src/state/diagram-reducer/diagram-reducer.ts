// Pure reducer — the single owner of diagram state. Every update is immutable
// with structural sharing so memoized scene components skip untouched nodes.

import { packLayout } from '../../engine/layout/pack-layout';
import type { Focus, Model, RoutingMode, Selection } from '../../engine/model/types';

export type DiagramGesture =
  | { kind: 'idle' }
  | { kind: 'entity'; id: string } // dragging one card
  | { kind: 'group' } // dragging a group box
  | { kind: 'resize' }; // resizing a group box

export interface DiagramView {
  zoom: number;
  panX: number;
  panY: number;
  routing: RoutingMode;
}

export interface DiagramUi {
  panelSelection: Selection; // what the DetailPanel shows
  focus: Focus; // what the canvas highlights
  hidden: { groups: ReadonlySet<string>; kinds: ReadonlySet<string> };
  colors: ReadonlyMap<string, string>;
  fieldHighlight: { entityId: string; field: string } | null;
  raisedEdge: string | null; // renders last → paints on top
  gesture: DiagramGesture;
}

export interface DiagramState {
  model: Model | null;
  view: DiagramView;
  ui: DiagramUi;
}

export const initialDiagramState: DiagramState = {
  model: null,
  view: { zoom: 1, panX: 0, panY: 0, routing: 'curved' },
  ui: {
    panelSelection: { type: 'none' },
    focus: null,
    hidden: { groups: new Set(), kinds: new Set() },
    colors: new Map(),
    fieldHighlight: null,
    raisedEdge: null,
    gesture: { kind: 'idle' },
  },
};

export type DiagramAction =
  | { type: 'LOAD'; model: Model }
  | { type: 'REPACK' } // fonts.ready — keeps focus
  | { type: 'REARRANGE' } // toolbar — clears focus
  | { type: 'SET_VIEW'; view: Partial<Pick<DiagramView, 'zoom' | 'panX' | 'panY'>> }
  | { type: 'SET_ROUTING'; routing: RoutingMode }
  | { type: 'SET_COLORS'; colors: ReadonlyMap<string, string> }
  | { type: 'TOGGLE_GROUP'; id: string }
  | { type: 'TOGGLE_KIND'; id: string }
  | { type: 'SET_POSITIONS'; entities: { id: string; x: number; y: number }[]; boxes: { id: string; x: number; y: number }[] }
  | { type: 'RESIZE_GROUP'; id: string; x: number; y: number; w: number; h: number }
  | { type: 'SET_GESTURE'; gesture: DiagramGesture }
  | { type: 'SELECT_ENTITY'; id: string }
  | { type: 'SELECT_GROUP'; id: string }
  | { type: 'ISOLATE_EDGE'; id: string; silent?: boolean }
  | { type: 'FOCUS_FROM_SEARCH'; entityId: string; field?: string }
  | { type: 'HIGHLIGHT_FIELD'; entityId: string; field: string }
  | { type: 'CLEAR_FIELD_HIGHLIGHT' }
  | { type: 'RAISE_EDGE'; id: string }
  | { type: 'CLEAR_SELECTION' };

function toggled(set: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

function withPositions(model: Model, ents: { id: string; x: number; y: number }[], boxes: { id: string; x: number; y: number }[]): Model {
  let entities = model.entities;
  let entityById = model.entityById;
  if (ents.length) {
    const moved = new Map(ents.map((m) => [m.id, m]));
    entities = model.entities.map((e) => {
      const m = moved.get(e.id);
      return m ? { ...e, x: m.x, y: m.y } : e;
    });
    entityById = new Map(entities.map((e) => [e.id, e]));
  }
  let groupBounds = model._groupBounds;
  if (boxes.length) {
    const movedB = new Map(boxes.map((b) => [b.id, b]));
    groupBounds = model._groupBounds.map((b) => {
      const m = movedB.get(b.id);
      return m ? { ...b, x: m.x, y: m.y } : b;
    });
  }
  return { ...model, entities, entityById, _groupBounds: groupBounds };
}

export function diagramReducer(state: DiagramState, action: DiagramAction): DiagramState {
  switch (action.type) {
    case 'LOAD':
      return {
        model: packLayout(action.model),
        view: { zoom: 1, panX: 0, panY: 0, routing: action.model.view.routing },
        ui: { ...initialDiagramState.ui, hidden: { groups: new Set(), kinds: new Set() }, colors: new Map() },
      };
    case 'REPACK':
      return state.model ? { ...state, model: packLayout(state.model) } : state;
    case 'REARRANGE':
      // Toolbar "Rearrange" must actually move cards — a saved layout would
      // otherwise snap everything straight back, making the button a no-op.
      return state.model
        ? {
            ...state,
            model: packLayout({ ...state.model, _savedLayout: undefined }),
            ui: { ...state.ui, focus: null, panelSelection: { type: 'none' }, fieldHighlight: null, raisedEdge: null },
          }
        : state;
    case 'SET_VIEW':
      return { ...state, view: { ...state.view, ...action.view } };
    case 'SET_ROUTING':
      return { ...state, view: { ...state.view, routing: action.routing } };
    case 'SET_COLORS':
      return { ...state, ui: { ...state.ui, colors: action.colors } };
    case 'TOGGLE_GROUP':
      return { ...state, ui: { ...state.ui, hidden: { ...state.ui.hidden, groups: toggled(state.ui.hidden.groups, action.id) } } };
    case 'TOGGLE_KIND':
      return { ...state, ui: { ...state.ui, hidden: { ...state.ui.hidden, kinds: toggled(state.ui.hidden.kinds, action.id) } } };
    case 'SET_POSITIONS':
      return state.model ? { ...state, model: withPositions(state.model, action.entities, action.boxes) } : state;
    case 'RESIZE_GROUP':
      return state.model
        ? {
            ...state,
            model: {
              ...state.model,
              _groupBounds: state.model._groupBounds.map((b) =>
                b.id === action.id ? { ...b, x: action.x, y: action.y, w: action.w, h: action.h } : b,
              ),
            },
          }
        : state;
    case 'SET_GESTURE':
      return { ...state, ui: { ...state.ui, gesture: action.gesture } };
    case 'SELECT_ENTITY':
      return {
        ...state,
        ui: { ...state.ui, focus: { type: 'entity', id: action.id }, panelSelection: { type: 'entity', id: action.id }, fieldHighlight: null },
      };
    case 'SELECT_GROUP':
      return { ...state, ui: { ...state.ui, focus: { type: 'group', id: action.id }, panelSelection: { type: 'group', id: action.id } } };
    case 'ISOLATE_EDGE':
      return {
        ...state,
        ui: {
          ...state.ui,
          focus: { type: 'edge', id: action.id },
          raisedEdge: action.id,
          panelSelection: action.silent ? state.ui.panelSelection : { type: 'edge', id: action.id },
        },
      };
    case 'FOCUS_FROM_SEARCH':
      return {
        ...state,
        ui: {
          ...state.ui,
          focus: { type: 'entity', id: action.entityId },
          panelSelection: { type: 'entity', id: action.entityId },
          fieldHighlight: action.field ? { entityId: action.entityId, field: action.field } : null,
        },
      };
    case 'HIGHLIGHT_FIELD':
      return { ...state, ui: { ...state.ui, fieldHighlight: { entityId: action.entityId, field: action.field } } };
    case 'CLEAR_FIELD_HIGHLIGHT':
      return state.ui.fieldHighlight ? { ...state, ui: { ...state.ui, fieldHighlight: null } } : state;
    case 'RAISE_EDGE':
      return { ...state, ui: { ...state.ui, raisedEdge: action.id } };
    case 'CLEAR_SELECTION':
      return {
        ...state,
        ui: { ...state.ui, focus: null, panelSelection: { type: 'none' }, fieldHighlight: null, raisedEdge: null },
      };
  }
}
