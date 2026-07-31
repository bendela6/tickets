import { ARTBOARD_MAX, ARTBOARD_MIN, SNAP_MIN } from './constants';
import { newObject, objectId } from './defaults';
import { bounds, fitToBox, translate, type Box } from './geometry';
import { snapGeometry, snapTo } from './snap';
import type {
  Artboard,
  Geometry,
  Ground,
  IconDoc,
  IconObject,
  Pair,
  ShapeKind,
  Sustain,
  Timing,
} from './types';

/**
 * Undo is keyboard-only and has no permanent surface — no button, no history
 * panel, no stack. In a tool with four shape types and one artboard a visible
 * undo would be the most prominent thing in the chrome and the least used. The
 * only feedback is the status slot bottom-right, which is why every undoable
 * action carries a `label`: it is what that slot echoes.
 *
 * History is whole-document snapshots rather than a command log. The document
 * is a few dozen small objects, so a snapshot costs nothing to take and cannot
 * drift from the state it describes the way an inverse-command pair can.
 */
const HISTORY_LIMIT = 50;

/** Two drags of the same object closer together than this merge into one entry. */
const COALESCE_MS = 400;

export interface EditorState {
  doc: IconDoc;
  selectedId: string | null;
  /** Shapes ever added, so names stay unique across deletions. */
  sequence: number;
  past: Snapshot[];
  future: Snapshot[];
  /** What the status slot echoes, and for how long the caller should show it. */
  lastAction: { label: string; at: number } | null;
  /** Internal: what the top of `past` was recorded for, so drags can coalesce. */
  coalesce: { key: string; at: number } | null;
}

interface Snapshot {
  doc: IconDoc;
  selectedId: string | null;
  label: string;
}

export type Action =
  | { type: 'addObject'; kind: ShapeKind }
  | { type: 'selectObject'; id: string | null }
  | { type: 'deleteObject'; id: string }
  | { type: 'duplicateObject'; id: string }
  | { type: 'renameObject'; id: string; name: string }
  | { type: 'toggleHidden'; id: string }
  | { type: 'toggleLocked'; id: string }
  | { type: 'reorderObjects'; from: number; to: number }
  | { type: 'moveObject'; id: string; dx: number; dy: number; at?: number }
  | { type: 'setGeometry'; id: string; geometry: Geometry; label: string; at?: number }
  | { type: 'resizeObject'; id: string; box: Box; at?: number }
  | { type: 'rotateObject'; id: string; degrees: number; at?: number }
  | { type: 'setOpacity'; id: string; opacity: number; at?: number }
  | { type: 'setStrokeWidth'; id: string; width: number }
  | { type: 'setColor'; id: string; channel: 'fill' | 'stroke'; ground: Ground; hex: string }
  | { type: 'setBackground'; ground: Ground; hex: string }
  | { type: 'setArtboard'; artboard: Partial<Artboard> }
  | { type: 'setSnap'; snap: number }
  | { type: 'setMotion'; id: string; motion: Partial<IconObject['motion']> }
  | { type: 'addState' }
  | { type: 'renameState'; id: string; name: string }
  | { type: 'deleteState'; id: string }
  | { type: 'setSustain'; id: string; sustain: Sustain }
  | { type: 'reorderStates'; from: number; to: number }
  | { type: 'setTiming'; timing: Partial<Timing> }
  | { type: 'setDocumentName'; name: string }
  | { type: 'replaceDocument'; doc: IconDoc }
  | { type: 'undo' }
  | { type: 'redo' };

export function initialState(doc: IconDoc): EditorState {
  return {
    doc,
    selectedId: null,
    sequence: doc.objects.length,
    past: [],
    future: [],
    lastAction: null,
    coalesce: null,
  };
}

function moveWithin<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length || to < 0 || to >= list.length) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  if (item === undefined) return list;
  next.splice(to, 0, item);
  return next;
}

function mapObject(doc: IconDoc, id: string, fn: (object: IconObject) => IconObject): IconDoc {
  return { ...doc, objects: doc.objects.map((object) => (object.id === id ? fn(object) : object)) };
}

/**
 * Set an object's geometry, on the document's grid.
 *
 * Every route that moves or resizes anything goes through here rather than
 * snapping at the pointer, so a value typed into the properties panel lands on
 * the same grid a drag does. Snapping only the pointer would let the panel
 * write positions no drag could ever produce.
 */
function mapGeometry(
  doc: IconDoc,
  id: string,
  fn: (object: IconObject) => Geometry,
): IconDoc {
  return mapObject(doc, id, (o) =>
    o.locked ? o : { ...o, geometry: snapGeometry(fn(o), doc.snap) },
  );
}

const clampArtboard = (value: number): number =>
  Math.max(ARTBOARD_MIN, Math.min(ARTBOARD_MAX, Math.round(value)));

function nameOf(state: EditorState, id: string): string {
  return state.doc.objects.find((object) => object.id === id)?.name ?? 'object';
}

/**
 * Record the pre-change document, unless this edit continues one already
 * recorded. `key` identifies the gesture: dragging the same object twice
 * within COALESCE_MS is one undo entry, because a pointer drag arrives as
 * dozens of tiny moves and each one earning its own entry would make ⌘Z
 * useless.
 */
function remember(
  state: EditorState,
  label: string,
  gesture?: { key: string; at: number },
): Pick<EditorState, 'past' | 'future' | 'lastAction' | 'coalesce'> {
  const continues =
    gesture !== undefined &&
    state.coalesce !== null &&
    state.coalesce.key === gesture.key &&
    gesture.at - state.coalesce.at <= COALESCE_MS;

  const at = gesture?.at ?? 0;
  const entry: Snapshot = { doc: state.doc, selectedId: state.selectedId, label };
  const past = continues ? state.past : [...state.past, entry].slice(-HISTORY_LIMIT);

  return {
    past,
    // Any new edit abandons the redo branch: you cannot redo forward into a
    // future that no longer follows from the present.
    future: [],
    lastAction: { label, at },
    coalesce: gesture ? { key: gesture.key, at: gesture.at } : null,
  };
}

// eslint-disable-next-line complexity
export function editorReducer(state: EditorState, action: Action): EditorState {
  switch (action.type) {
    // ----- selection is not an edit, so it is not undoable -----------------
    case 'selectObject':
      return { ...state, selectedId: action.id };

    // ----- history --------------------------------------------------------
    case 'undo': {
      const entry = state.past.at(-1);
      if (!entry) return state;
      return {
        ...state,
        doc: entry.doc,
        selectedId: entry.selectedId,
        past: state.past.slice(0, -1),
        future: [
          ...state.future,
          { doc: state.doc, selectedId: state.selectedId, label: entry.label },
        ],
        lastAction: { label: `undid · ${entry.label}`, at: 0 },
        coalesce: null,
      };
    }
    case 'redo': {
      const entry = state.future.at(-1);
      if (!entry) return state;
      return {
        ...state,
        doc: entry.doc,
        selectedId: entry.selectedId,
        past: [
          ...state.past,
          { doc: state.doc, selectedId: state.selectedId, label: entry.label },
        ].slice(-HISTORY_LIMIT),
        future: state.future.slice(0, -1),
        lastAction: { label: `redid · ${entry.label}`, at: 0 },
        coalesce: null,
      };
    }

    // ----- objects --------------------------------------------------------
    case 'addObject': {
      const sequence = state.sequence + 1;
      const object = newObject(action.kind, sequence, state.doc.artboard, state.doc.snap);
      return {
        ...state,
        ...remember(state, `add ${action.kind}`),
        // Front-to-back: a new shape lands in front of everything.
        doc: { ...state.doc, objects: [object, ...state.doc.objects] },
        selectedId: object.id,
        sequence,
      };
    }
    case 'deleteObject': {
      const label = `delete ${nameOf(state, action.id)}`;
      return {
        ...state,
        ...remember(state, label),
        doc: { ...state.doc, objects: state.doc.objects.filter((o) => o.id !== action.id) },
        selectedId: state.selectedId === action.id ? null : state.selectedId,
      };
    }
    case 'duplicateObject': {
      const source = state.doc.objects.find((o) => o.id === action.id);
      if (!source) return state;
      const sequence = state.sequence + 1;
      const kind = source.geometry.kind;
      // A copy is a new object, not a second reference: `structuredClone`
      // rather than a spread, or the two would share one geometry and one
      // colour pair and editing either would move both.
      const copy: IconObject = {
        ...structuredClone(source),
        id: objectId(kind, sequence),
        name: `${source.name} copy`,
        // A duplicate arrives unlocked whatever the original was, because it
        // was made to be moved.
        locked: false,
      };
      const at = state.doc.objects.findIndex((o) => o.id === action.id);
      const objects = state.doc.objects.slice();
      objects.splice(at, 0, copy);
      return {
        ...state,
        ...remember(state, `duplicate ${source.name}`),
        doc: { ...state.doc, objects },
        selectedId: copy.id,
        sequence,
      };
    }
    case 'renameObject':
      return {
        ...state,
        ...remember(state, `rename ${nameOf(state, action.id)}`),
        doc: mapObject(state.doc, action.id, (o) => ({ ...o, name: action.name })),
      };
    case 'toggleHidden': {
      const object = state.doc.objects.find((o) => o.id === action.id);
      const label = `${object?.hidden ? 'show' : 'hide'} ${nameOf(state, action.id)}`;
      return {
        ...state,
        ...remember(state, label),
        doc: mapObject(state.doc, action.id, (o) => ({ ...o, hidden: !o.hidden })),
      };
    }
    case 'toggleLocked': {
      const object = state.doc.objects.find((o) => o.id === action.id);
      const label = `${object?.locked ? 'unlock' : 'lock'} ${nameOf(state, action.id)}`;
      return {
        ...state,
        ...remember(state, label),
        doc: mapObject(state.doc, action.id, (o) => ({ ...o, locked: !o.locked })),
      };
    }
    case 'reorderObjects': {
      const objects = moveWithin(state.doc.objects, action.from, action.to);
      if (objects === state.doc.objects) return state;
      return { ...state, ...remember(state, 'reorder'), doc: { ...state.doc, objects } };
    }

    // ----- direct manipulation -------------------------------------------
    case 'moveObject': {
      const label = `move ${nameOf(state, action.id)}`;
      return {
        ...state,
        ...remember(state, label, { key: `move:${action.id}`, at: action.at ?? 0 }),
        doc: mapGeometry(state.doc, action.id, (o) =>
          translate(o.geometry, action.dx, action.dy),
        ),
      };
    }
    case 'setGeometry':
      return {
        ...state,
        ...remember(state, action.label, { key: `geometry:${action.id}`, at: action.at ?? 0 }),
        doc: mapGeometry(state.doc, action.id, () => action.geometry),
      };
    case 'resizeObject': {
      const label = `resize ${nameOf(state, action.id)}`;
      return {
        ...state,
        ...remember(state, label, { key: `resize:${action.id}`, at: action.at ?? 0 }),
        doc: mapGeometry(state.doc, action.id, (o) => fitToBox(o, action.box)),
      };
    }
    case 'rotateObject': {
      const label = `rotate ${nameOf(state, action.id)}`;
      return {
        ...state,
        ...remember(state, label, { key: `rotate:${action.id}`, at: action.at ?? 0 }),
        doc: mapObject(state.doc, action.id, (o) =>
          o.locked ? o : { ...o, rotation: ((action.degrees % 360) + 360) % 360 },
        ),
      };
    }

    // ----- appearance -----------------------------------------------------
    case 'setOpacity':
      return {
        ...state,
        ...remember(state, `opacity ${nameOf(state, action.id)}`, {
          key: `opacity:${action.id}`,
          at: action.at ?? 0,
        }),
        doc: mapObject(state.doc, action.id, (o) => ({
          ...o,
          opacity: Math.max(0, Math.min(100, Math.round(action.opacity))),
        })),
      };
    case 'setStrokeWidth':
      return {
        ...state,
        ...remember(state, `stroke ${nameOf(state, action.id)}`),
        doc: mapObject(state.doc, action.id, (o) => ({
          ...o,
          strokeWidth: Math.max(0, snapTo(action.width, state.doc.snap)),
        })),
      };
    case 'setColor': {
      const label = `${action.channel} ${nameOf(state, action.id)}`;
      const half = (pair: Pair): Pair => ({ ...pair, [action.ground]: action.hex });
      return {
        ...state,
        ...remember(state, label),
        doc: mapObject(state.doc, action.id, (o) =>
          action.channel === 'fill'
            ? { ...o, fill: half(o.fill) }
            : { ...o, stroke: half(o.stroke) },
        ),
      };
    }
    case 'setBackground':
      return {
        ...state,
        ...remember(state, 'background'),
        doc: {
          ...state.doc,
          background: { ...state.doc.background, [action.ground]: action.hex },
        },
      };
    case 'setArtboard': {
      const artboard = {
        width: clampArtboard(action.artboard.width ?? state.doc.artboard.width),
        height: clampArtboard(action.artboard.height ?? state.doc.artboard.height),
      };
      return {
        ...state,
        ...remember(state, `artboard ${artboard.width} × ${artboard.height}`),
        doc: { ...state.doc, artboard },
      };
    }
    case 'setSnap': {
      const snap = Math.max(SNAP_MIN, action.snap);
      // Re-snapping what is already there is the point: changing the step to 8
      // and leaving everything on halves would mean the grid describes what
      // will happen next rather than what the document is.
      return {
        ...state,
        ...remember(state, `step ${snap}`),
        doc: {
          ...state.doc,
          snap,
          objects: state.doc.objects.map((object) => ({
            ...object,
            geometry: snapGeometry(object.geometry, snap),
            strokeWidth: snapTo(object.strokeWidth, snap),
          })),
        },
      };
    }
    case 'setMotion':
      return {
        ...state,
        ...remember(state, `motion ${nameOf(state, action.id)}`),
        doc: mapObject(state.doc, action.id, (o) => ({
          ...o,
          motion: { ...o.motion, ...action.motion },
        })),
      };

    // ----- states ---------------------------------------------------------
    case 'addState': {
      const id = `state-${state.doc.states.length + 1}-${state.past.length}`;
      const name = `state ${state.doc.states.length + 1}`;
      return {
        ...state,
        ...remember(state, 'add state'),
        doc: { ...state.doc, states: [...state.doc.states, { id, name, sustain: null }] },
      };
    }
    case 'renameState':
      return {
        ...state,
        ...remember(state, 'rename state'),
        doc: {
          ...state.doc,
          states: state.doc.states.map((s) => (s.id === action.id ? { ...s, name: action.name } : s)),
        },
      };
    case 'deleteState': {
      // The floor is one, not two: a purely static icon is the common case,
      // and a tool that insists on a second state invents motion the icon
      // does not need.
      if (state.doc.states.length <= 1) return state;
      return {
        ...state,
        ...remember(state, 'delete state'),
        doc: { ...state.doc, states: state.doc.states.filter((s) => s.id !== action.id) },
      };
    }
    case 'setSustain':
      return {
        ...state,
        ...remember(state, 'sustain'),
        doc: {
          ...state.doc,
          states: state.doc.states.map((s) =>
            s.id === action.id ? { ...s, sustain: action.sustain } : s,
          ),
        },
      };
    case 'reorderStates': {
      const states = moveWithin(state.doc.states, action.from, action.to);
      if (states === state.doc.states) return state;
      return { ...state, ...remember(state, 'reorder states'), doc: { ...state.doc, states } };
    }
    case 'setTiming':
      return {
        ...state,
        ...remember(state, 'timing'),
        doc: { ...state.doc, timing: { ...state.doc.timing, ...action.timing } },
      };

    // ----- document -------------------------------------------------------
    case 'setDocumentName':
      return {
        ...state,
        ...remember(state, 'rename document'),
        doc: { ...state.doc, name: action.name },
      };
    case 'replaceDocument':
      // Opening another document is not an edit to this one: its history has
      // nothing to undo into, so the stacks are cleared rather than carried.
      return initialState(action.doc);
  }
}

export const canUndo = (state: EditorState): boolean => state.past.length > 0;
export const canRedo = (state: EditorState): boolean => state.future.length > 0;

export function selectedObject(state: EditorState): IconObject | null {
  return state.doc.objects.find((object) => object.id === state.selectedId) ?? null;
}

/** The selected object's box, or null — what the selection overlay draws around. */
export function selectionBox(state: EditorState): Box | null {
  const object = selectedObject(state);
  return object && !object.hidden ? bounds(object) : null;
}
