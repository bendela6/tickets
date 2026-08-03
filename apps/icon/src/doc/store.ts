import { combinePlan, nonZeroWound, type BooleanOp } from '../boolean/ops';
import { ARTBOARD_MAX, ARTBOARD_MIN, SNAP_MIN } from './constants';
import { NO_TRANSFORM, groupId, newObject, objectFor, objectId } from './defaults';
import {
  boxCentre,
  fitToBox,
  insertVertex,
  removeVertex,
  translate,
  unionBox,
  vertexPoints,
  type Box,
} from './geometry';
import { penIsDrawable, penSegments, type PenAnchor } from './pen';
import { snapGeometry, snapTo } from './snap';
import {
  ARTBOARD_FRAME,
  ancestorsOf,
  boxThrough,
  clampScale,
  contentBox,
  dissolved,
  everyNode,
  findNode,
  frameOf,
  isGroup,
  isLocked,
  levelOf,
  listAt,
  localBounds,
  mapList,
  mapNode,
  nodesInBox,
  outlineOf,
  prunedEntry,
  transformAt,
  unplace,
  withoutNodes,
  type Placement,
} from './tree';
import type {
  Artboard,
  Effects,
  Geometry,
  GroupTransform,
  Ground,
  IconDoc,
  IconGroup,
  IconNode,
  IconObject,
  Pair,
  PathSegment,
  Point,
  Shadow,
  ShapeKind,
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

/**
 * What the pointer on the artboard currently means.
 *
 * `select` is the editor's whole behaviour up to now — press to select, drag to
 * move, handles to resize — and every existing tool creates its shape outright
 * rather than entering anything. The pen is the first that cannot: a path is
 * built click by click, so the presses between the first and the last have to
 * mean something other than what they normally mean.
 */
export type Tool = 'select' | 'pen';

export interface EditorState {
  doc: IconDoc;
  /**
   * What is selected, in the order it was selected.
   *
   * A `Set` because the two things asked of it pull in different directions. On
   * every render every row of the object rail asks whether it is in there,
   * which a list answers by scanning and this answers in one step. And what
   * comes next — grouping, then boolean operations — needs an order: a subtract
   * has a first operand, and "the one you picked first" is the only answer a
   * user can predict. A `Set` iterates in insertion order, so it is both, and
   * it cannot hold the same id twice — which is why the shift-click toggle has
   * no duplicate case to defend against.
   *
   * Empty rather than null when nothing is selected. There is one accessor for
   * the callers that mean *the* selected object — `selectedObject` — so nothing
   * else has to compare a size against one.
   */
  selectedIds: ReadonlySet<string>;
  /**
   * Which node of the selected shape is selected, if any.
   *
   * Here rather than in the canvas's own state for two reasons. It is read as
   * far away as the keyboard layer — Backspace has to remove a selected node
   * instead of the whole object, and the shortcuts are bound at the top of the
   * app, where a canvas-local `useState` is invisible. And it is one of a pair:
   * an object selection and a node selection are the same idea at two scales,
   * and splitting them across two owners means two places to invalidate when a
   * shape is deleted, replaced or undone out from under them.
   *
   * It carries the object's id so a stale index cannot be read against the
   * wrong shape, and like `selectedIds` it is not an edit — nothing here enters
   * the undo history. Editing a node is only meaningful while exactly one shape
   * is selected: every selection action clears this, and `selectedNodeIndex`
   * refuses to answer for a selection of several, so a second shape joining the
   * selection can never leave a node selected inside the first.
   */
  selectedNode: { id: string; index: number } | null;
  /**
   * Which tool the artboard is answering to, and the anchors of the path being
   * drawn if that tool is the pen.
   *
   * Here rather than in the canvas's own state, for the reasons `selectedNode`
   * is: it is read as far away as the keyboard layer — Enter finishes a path,
   * Backspace takes back an anchor, and the shortcuts are bound at the top of
   * the app where a canvas-local `useState` is invisible — and the left rail's
   * tool button has to show whether the mode is on, which is a third subtree
   * again. One owner, or three copies to keep in step.
   *
   * Like `selectedIds` and `selectedNode`, neither field is an edit: entering
   * the pen writes `tool` and nothing else, so the document, the history and
   * whatever was selected are all exactly what they were. What is drawn only
   * becomes a document when the tool ends.
   *
   * Where the pointer is *right now* is deliberately not here. It is read by
   * one overlay and nothing else, and putting it through the reducer would
   * re-render the whole editor on every mouse move to move one dashed line.
   */
  tool: Tool;
  /** The anchors placed so far. Empty unless the pen is part way through a path. */
  pen: PenAnchor[];
  /**
   * Which groups you are standing inside, outermost first.
   *
   * This is the whole of "entering" and "leaving" a group: not a mode and not a
   * flag on the group, but the path down to the list that clicks pick from.
   * Empty means the document's own list, which is where every session starts
   * and where a document with no groups in it never leaves.
   *
   * On the state rather than in the canvas for the reason `selectedNode` is:
   * Escape steps out and is bound at the top of the app, the rail has to show
   * which level you are in, and the marquee and select-all both have to catch
   * members of it. Three readers, so one owner.
   *
   * Like the selection it is not an edit and never enters the history — but it
   * *is* derived from the selection: selecting a node opens exactly the groups
   * above it, so there is no way to be looking at one level while something in
   * another is selected.
   */
  entered: readonly string[];
  /** Nodes ever added, so names and ids stay unique across deletions. */
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
  selectedIds: ReadonlySet<string>;
  label: string;
}

/**
 * One node's new placement, as a batch of them is stated.
 *
 * A union rather than two optional fields, so a caller cannot hand over an edit
 * that names neither and be silently ignored: a shape is its geometry and a
 * group is its transform, and a drag of a mixed selection carries both.
 */
export type PlacementEdit =
  | { id: string; geometry: Geometry }
  | { id: string; transform: GroupTransform };

export type Action =
  | { type: 'addObject'; kind: ShapeKind }
  /** Replace the whole selection with one object, or clear it. */
  | { type: 'selectObject'; id: string | null }
  /** Shift-click: put the object into the selection, or take it back out. */
  | { type: 'toggleSelect'; id: string }
  /**
   * What a marquee caught, in document units. `additive` is the shift that
   * makes a band add to the selection rather than replace it.
   *
   * The reducer works out what the box touches rather than the caller, so the
   * rule about what a band may catch sits beside select-all's rather than in
   * the pointer layer, where only a pointer test could reach it.
   */
  | { type: 'selectInBox'; box: Box; additive: boolean }
  | { type: 'selectAll' }
  | { type: 'selectNode'; index: number | null }
  /**
   * Step into a group, so clicks pick its children rather than it. `select` is
   * what was under the pointer once you were inside, because a double-click
   * that entered and then selected nothing would throw away the aim.
   */
  | { type: 'enterGroup'; id: string; select: string | null }
  /** Step out one level, leaving the group you were inside selected. */
  | { type: 'exitGroup' }
  /** Collect the selection into a group. */
  | { type: 'groupSelection' }
  /** Take every selected group apart, putting its children back in its place. */
  | { type: 'ungroupSelection' }
  /**
   * The selection becomes one shape: the operands go, and `segments` — which is
   * what the engine answered with, already in artboard units — arrives in their
   * place as a single path.
   *
   * The commands come in from outside because working them out needs a
   * WebAssembly module and a promise, neither of which belongs in a reducer.
   * Everything else about the result is worked out *here*, from the ids and the
   * document: which operand was frontmost, where the result goes and what it is
   * painted with are statements about the document, and a caller that computed
   * them would be a second place they could be decided differently.
   */
  | {
      type: 'combineShapes';
      op: BooleanOp;
      /** The operands, in the order they were selected and sent to the engine. */
      ids: readonly string[];
      segments: PathSegment[];
    }
  /**
   * Enter a tool. Leaving the pen is not a bare mode switch — there may be a
   * path half drawn — so it is routed through `penEnd`, which is the one place
   * that decides what becomes of one.
   */
  | { type: 'setTool'; tool: Tool }
  /** Place an anchor. `at` is in artboard units and lands on the document's grid. */
  | { type: 'penPoint'; at: Point }
  /**
   * Pull a curve handle out of the anchor just placed. `at` is where the
   * pointer is, not a delta: the anchor was snapped on the way in, and the
   * handle has to be measured from where it actually landed.
   */
  | { type: 'penHandle'; at: Point }
  /** Take back the last anchor placed. */
  | { type: 'penBack' }
  /**
   * Finish, and leave the tool. `close` writes the `Z`. What was drawn becomes
   * one object and one history entry, or nothing at all if it never grew past
   * a single anchor.
   */
  | { type: 'penEnd'; close: boolean }
  /**
   * `at` is in artboard units and `reach` is how near the outline it had to
   * land. The reducer does the geometry rather than the caller so that adding a
   * node is one undoable step that also leaves the new node selected — two
   * dispatches would let a drag of the same object a moment earlier swallow it
   * into the same history entry.
   */
  | { type: 'insertVertex'; id: string; at: Point; reach: number }
  | { type: 'removeVertex'; id: string; index: number }
  /**
   * Delete every one of them, as one entry. Taking a selection of three away
   * has to come back in one undo: it was one press of one key.
   */
  | { type: 'deleteObjects'; ids: readonly string[] }
  | { type: 'duplicateObject'; id: string }
  | { type: 'renameObject'; id: string; name: string }
  | { type: 'toggleHidden'; id: string }
  | { type: 'toggleLocked'; id: string }
  /**
   * Move a row within the list it is in. `parentId` names that list — a group's
   * id, or null for the document's own — because an index means nothing without
   * one once the list is a tree.
   */
  | { type: 'reorderObjects'; parentId: string | null; from: number; to: number }
  | { type: 'moveObject'; id: string; dx: number; dy: number; at?: number }
  | { type: 'setGeometry'; id: string; geometry: Geometry; label: string; at?: number }
  /**
   * Several nodes rewritten at once — what a drag of a multiple selection
   * commits. Each edit is the placement that node should end up with, so the
   * batch stays as absolute as the single case: the pointer recomputes every
   * one of them from what it captured at the press.
   */
  | { type: 'setPlacements'; edits: readonly PlacementEdit[]; label: string; at?: number }
  | { type: 'resizeObject'; id: string; box: Box; at?: number }
  /**
   * A group resized to `box`, which is stated in artboard units — the box the
   * selection outline should end up occupying.
   *
   * Its own action rather than `resizeObject` because a group has no geometry to
   * fit into a box: what changes is one scale, and the position that keeps the
   * dragged corner under the pointer. The box arrives with the group's aspect
   * ratio already preserved, so only its width is read.
   */
  | { type: 'resizeGroup'; id: string; box: Box; at?: number }
  | { type: 'rotateObject'; id: string; degrees: number; at?: number }
  /** A group's transform typed rather than dragged. */
  | { type: 'setGroupTransform'; id: string; transform: GroupTransform }
  // Appearance takes a list rather than an id: these are the properties a
  // selection of several genuinely shares, and an edit to one of them has to
  // reach all of them as a single entry.
  | { type: 'setOpacity'; ids: readonly string[]; opacity: number; at?: number }
  | { type: 'setStrokeWidth'; ids: readonly string[]; width: number }
  /**
   * A gaussian softening of the whole object, in document units. Zero is none —
   * which the document says by having no such field at all, so zero takes the
   * field back off rather than writing a number meaning "nothing".
   */
  | { type: 'setBlur'; ids: readonly string[]; blur: number }
  /**
   * The shadow, whole, rather than a field of it at a time: the rail already
   * holds the current one, and sending it back with one number changed keeps
   * every edit a single entry without a reducer that merges partials. `null` is
   * none, and takes the field off by the same rule as above.
   */
  | { type: 'setShadow'; ids: readonly string[]; shadow: Shadow | null }
  | {
      type: 'setColor';
      ids: readonly string[];
      channel: 'fill' | 'stroke';
      ground: Ground;
      hex: string;
    }
  | { type: 'setBackground'; ground: Ground; hex: string }
  | { type: 'setArtboard'; artboard: Partial<Artboard> }
  | { type: 'setSnap'; snap: number }
  | { type: 'setDocumentName'; name: string }
  | { type: 'replaceDocument'; doc: IconDoc }
  | { type: 'undo' }
  | { type: 'redo' };

/** Nothing selected. One value rather than a fresh empty set each time. */
const NOTHING: ReadonlySet<string> = new Set();

/** The one member of a set, or null unless it holds exactly one. */
function sole<T>(set: ReadonlySet<T>): T | null {
  if (set.size !== 1) return null;
  for (const item of set) return item;
  return null;
}

export function initialState(doc: IconDoc): EditorState {
  return {
    doc,
    selectedIds: NOTHING,
    selectedNode: null,
    tool: 'select',
    pen: [],
    entered: [],
    // Counted through the whole tree, not across the top list: two nodes with
    // the same id would make every lookup below ambiguous, and a document that
    // arrives holding groups has more nodes than it has top-level rows.
    sequence: everyNode(doc.objects).length,
    past: [],
    future: [],
    lastAction: null,
    coalesce: null,
  };
}

function moveWithin<T>(list: readonly T[], from: number, to: number): T[] {
  const next = list.slice();
  if (from === to || from < 0 || from >= list.length || to < 0 || to >= list.length) return next;
  const [item] = next.splice(from, 1);
  if (item === undefined) return list.slice();
  next.splice(to, 0, item);
  return next;
}

/** The tree with one node rewritten, wherever in it that node sits. */
function withNode(doc: IconDoc, id: string, fn: (node: IconNode) => IconNode): IconDoc {
  return { ...doc, objects: mapNode(doc.objects, id, fn) };
}

/**
 * The same, for an edit that reaches every *shape* in a selection.
 *
 * Shapes only, and that is the answer to what a fill does to a group: nothing.
 * A group has no paint of its own to set — the model gives it none, so that a
 * colour can never come from two places — and reaching through it to repaint
 * every child would be a different command, one that cannot be undone by
 * setting the colour back because it does not remember what each child was.
 */
function mapShapes(
  doc: IconDoc,
  ids: readonly string[],
  fn: (object: IconObject) => IconObject,
): IconDoc {
  return ids.reduce(
    (next, id) => withNode(next, id, (node) => (isGroup(node) ? node : fn(node))),
    doc,
  );
}

/**
 * The node with one effect taken back off — removed rather than set to
 * `undefined`, because the model states "none" by having no field at all. A
 * node carrying `blur: undefined` is a document no fresh shape and no old save
 * ever produces: identical on screen, different to every comparison.
 */
function withoutEffect(node: IconNode, key: keyof Effects): IconNode {
  if (!(key in node)) return node;
  const bare = { ...node };
  delete bare[key];
  return bare;
}

/**
 * Set a shape's geometry, on the document's grid.
 *
 * Every route that moves or resizes anything goes through here rather than
 * snapping at the pointer, so a value typed into the properties panel lands on
 * the same grid a drag does. Snapping only the pointer would let the panel
 * write positions no drag could ever produce.
 *
 * A locked *ancestor* holds it as firmly as its own lock does — locking a group
 * is a statement about the arrangement inside it, and one that only held for
 * the group's own outline would not be worth making.
 */
function mapGeometry(doc: IconDoc, id: string, fn: (object: IconObject) => Geometry): IconDoc {
  if (isLocked(doc.objects, id)) return doc;
  return withNode(doc, id, (node) =>
    isGroup(node) ? node : { ...node, geometry: snapGeometry(fn(node), doc.snap) },
  );
}

/** The same for a group, which has a transform where a shape has geometry. */
function mapTransform(
  doc: IconDoc,
  id: string,
  fn: (group: IconGroup) => GroupTransform,
): IconDoc {
  if (isLocked(doc.objects, id)) return doc;
  return withNode(doc, id, (node) =>
    isGroup(node) ? { ...node, transform: snapTransform(fn(node), doc.snap) } : node,
  );
}

/**
 * A group's transform on the document's grid.
 *
 * Its position lands on the grid for the same reason a shape's does. The scale
 * and the turn do not: a scale is a ratio rather than a position, and rounding
 * one to the grid would mean a group could not be made 1% bigger on a board
 * whose step is 1.
 */
const snapTransform = (transform: GroupTransform, step: number): GroupTransform => ({
  ...transform,
  x: snapTo(transform.x, step),
  y: snapTo(transform.y, step),
  scale: clampScale(transform.scale),
});

const clampArtboard = (value: number): number =>
  Math.max(ARTBOARD_MIN, Math.min(ARTBOARD_MAX, Math.round(value)));

function nameOf(state: EditorState, id: string): string {
  return findNode(state.doc.objects, id)?.name ?? 'object';
}

/** The shape with this id, or null when the id names a group or nothing. */
function shapeById(doc: IconDoc, id: string): IconObject | null {
  const node = findNode(doc.objects, id);
  return node === null || isGroup(node) ? null : node;
}

/**
 * What an edit that may touch several objects calls them in the status slot.
 * One shape is worth naming; three are a count — `fill rect 1, ellipse 2,
 * line 3` states the same thing at four times the width.
 */
function subjectOf(state: EditorState, ids: readonly string[]): string {
  const first = ids[0];
  return ids.length === 1 && first !== undefined ? nameOf(state, first) : `${ids.length} objects`;
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
  const entry: Snapshot = { doc: state.doc, selectedIds: state.selectedIds, label };
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
    //
    // Every case here clears the node selection, which is the whole of the rule
    // keeping the two coherent: a node is a place inside one shape, so anything
    // that changes which shapes are selected — including selecting the same one
    // again, which is how clicking the body of a shape stops editing its nodes
    // — ends node editing.
    case 'selectObject':
      return {
        ...state,
        selectedIds: action.id === null ? NOTHING : new Set([action.id]),
        selectedNode: null,
        // Selecting something opens exactly the groups above it and closes
        // every other one. That one rule is why entering a group needs no
        // second concept: clicking a row deep in the rail steps in, clicking a
        // top-level shape steps back out, and clicking bare canvas leaves
        // altogether — because you cannot be standing inside a group with
        // something outside it selected.
        entered: action.id === null ? [] : ancestorsOf(state.doc.objects, action.id).map((g) => g.id),
      };
    case 'toggleSelect': {
      const next = new Set(state.selectedIds);
      // Taking one out and putting it back puts it back at the *end*, which is
      // what insertion order is for: the selection reads in the order you
      // actually built it, not the order you first touched each shape.
      if (!next.delete(action.id)) next.add(action.id);
      return { ...state, selectedIds: next, selectedNode: null };
    }
    case 'selectInBox': {
      // Members of the level you are standing in, for the same reason a click
      // picks one: a band swept inside a group is aimed at what is in it.
      const caught = nodesInBox(state.doc.objects, action.box, state.entered).map((n) => n.id);
      return {
        ...state,
        selectedIds: action.additive
          ? new Set([...state.selectedIds, ...caught])
          : new Set(caught),
        selectedNode: null,
      };
    }
    case 'selectAll':
      return {
        ...state,
        // Hidden objects are not on screen to be selected. A locked one is
        // being held out of the way on purpose, and select-all is the one
        // gesture that would sweep it back under the pointer unasked. "All" is
        // all of the level you are in — inside a group, everything else is a
        // different subject.
        selectedIds: new Set(
          levelOf(state.doc.objects, state.entered)
            .list.filter((node) => !node.hidden && !node.locked)
            .map((node) => node.id),
        ),
        selectedNode: null,
      };
    case 'enterGroup': {
      const chain = ancestorsOf(state.doc.objects, action.id).map((group) => group.id);
      const target = findNode(state.doc.objects, action.id);
      if (!target || !isGroup(target)) return state;
      return {
        ...state,
        entered: [...chain, action.id],
        selectedIds: action.select === null ? NOTHING : new Set([action.select]),
        selectedNode: null,
      };
    }
    case 'exitGroup': {
      const leaving = state.entered.at(-1);
      if (leaving === undefined) return state;
      return {
        ...state,
        entered: state.entered.slice(0, -1),
        // The group you were inside is what you were working on, so it is what
        // you come back out holding. Stepping out and finding nothing selected
        // would mean re-finding it to move it, which is the usual next thing.
        selectedIds: new Set([leaving]),
        selectedNode: null,
      };
    }
    case 'selectNode': {
      const id = sole(state.selectedIds);
      return {
        ...state,
        selectedNode:
          action.index === null || id === null ? null : { id, index: action.index },
      };
    }

    // ----- the pen, which is a mode rather than an edit --------------------
    case 'setTool':
      if (action.tool === state.tool) return state;
      // Leaving the pen always goes through the one place that knows what to do
      // with a half-drawn path, whether the user pressed Escape, pressed the
      // tool button again, or reached for another tool entirely.
      if (state.tool === 'pen') return editorReducer(state, { type: 'penEnd', close: false });
      // Entering writes the tool and nothing else. No document, no history, no
      // selection — which is what lets you leave again and carry on where you
      // were.
      return { ...state, tool: action.tool, pen: [] };
    case 'penPoint': {
      if (state.tool !== 'pen') return state;
      // Snapped here rather than at the pointer, so the preview is drawn
      // against the anchor that will actually be committed. The grid is a
      // property of the document, and this is the document's own reducer.
      const point = {
        x: snapTo(action.at.x, state.doc.snap),
        y: snapTo(action.at.y, state.doc.snap),
      };
      return { ...state, pen: [...state.pen, { point, handle: null }] };
    }
    case 'penHandle': {
      const last = state.pen.at(-1);
      if (state.tool !== 'pen' || !last) return state;
      return {
        ...state,
        pen: [
          ...state.pen.slice(0, -1),
          {
            ...last,
            handle: { x: action.at.x - last.point.x, y: action.at.y - last.point.y },
          },
        ],
      };
    }
    case 'penBack':
      // Not undo: nothing has entered the document yet, so there is nothing for
      // undo to take back. Emptying the list leaves the tool active — you have
      // taken back every anchor, not left the mode.
      return state.tool === 'pen' ? { ...state, pen: state.pen.slice(0, -1) } : state;
    case 'penEnd': {
      if (state.tool !== 'pen') return state;
      const left: EditorState = { ...state, tool: 'select', pen: [] };
      // A single anchor is not a shape. Discarding it rather than committing it
      // costs nothing precisely because the draft was never in the document:
      // there is no object to delete and no history entry to unpick.
      if (!penIsDrawable(state.pen)) return left;
      const sequence = state.sequence + 1;
      const object = objectFor(
        { kind: 'path', segments: penSegments(state.pen, action.close) },
        sequence,
        state.doc.artboard,
        state.doc.snap,
      );
      return {
        ...left,
        // One `remember` for the whole drawing, because the whole drawing is
        // one write. `setGeometry`'s coalescing key exists to merge the dozens
        // of tiny writes a pointer drag makes, and it merges them by proximity
        // in time — 400ms, which is shorter than the gap between two considered
        // clicks of a pen. Holding the anchors outside the document until the
        // gesture ends means there is nothing to merge, and no window to be
        // wrong about.
        ...remember(state, 'draw path'),
        doc: { ...state.doc, objects: [object, ...state.doc.objects] },
        selectedIds: new Set([object.id]),
        selectedNode: null,
        entered: [],
        sequence,
      };
    }

    // ----- groups ---------------------------------------------------------
    case 'groupSelection': {
      const made = grouped(state);
      if (!made) return state;
      return {
        ...state,
        ...remember(state, `group ${made.group.children.length} objects`),
        doc: { ...state.doc, objects: made.objects },
        selectedIds: new Set([made.group.id]),
        selectedNode: null,
        // The new group sits in the list you were standing in, so the level
        // does not change — but the group itself is now what is selected, and
        // you are outside it looking at it rather than inside it.
        entered: [...state.entered],
        sequence: state.sequence + 1,
      };
    }
    case 'ungroupSelection': {
      const groups = [...state.selectedIds]
        .map((id) => findNode(state.doc.objects, id))
        .filter((node): node is IconGroup => node !== null && isGroup(node));
      if (groups.length === 0) return state;

      let objects = state.doc.objects;
      const freed = new Set<string>();
      for (const group of groups) {
        const children = dissolved(group);
        for (const child of children) freed.add(child.id);
        const above = ancestorsOf(objects, group.id).at(-1)?.id ?? null;
        objects = mapList(objects, above, (list) =>
          list.flatMap((node) => (node.id === group.id ? children : [node])),
        );
      }
      return {
        ...state,
        ...remember(state, `ungroup ${subjectOf(state, groups.map((g) => g.id))}`),
        doc: { ...state.doc, objects },
        // What comes back is what was inside: the thing you were holding is
        // gone, and its contents are the nearest true answer to "what now".
        selectedIds: freed,
        selectedNode: null,
        entered: prunedEntry(objects, state.entered),
      };
    }

    case 'combineShapes': {
      const plan = combinePlan(state.doc.objects, action.ids);
      // Worked out again rather than trusted: the engine is asynchronous, and
      // between the button and the answer an operand can have been deleted,
      // moved into a group or undone away. Nothing happens then — and no
      // history entry is written, because an entry for an edit that did not
      // land is an undo that appears to do nothing.
      if (!plan || action.segments.length === 0) return state;
      const sequence = state.sequence + 1;
      const front = plan.front.shape;
      const result: IconObject = {
        // The frontmost operand's effects, for the same reason the result wears
        // its colour: it is the one that was on top, and the one you were
        // already looking at. Spread conditionally so a result cut from plain
        // shapes carries no field at all rather than an empty one.
        ...(front.blur === undefined ? {} : { blur: front.blur }),
        ...(front.shadow === undefined ? {} : { shadow: front.shadow }),
        id: objectId('path', sequence),
        // Named for what made it. Every other object is named for its kind, but
        // four operations all produce a `path` and the name is the only place
        // the rail can say which of them this was.
        name: `${action.op} ${sequence}`,
        // Wound the way this document states a hole, which is the one thing
        // about the answer that is the document's business rather than the
        // engine's. Not put on the document's grid, though, and that is equally
        // deliberate: the grid is where a position someone typed or dragged
        // lands, while these commands are where two outlines actually cross,
        // and laying them on it would move the result off the shapes it was cut
        // from — visibly, at every corner.
        geometry: { kind: 'path', segments: nonZeroWound(action.segments) },
        // A boolean is a change of shape, not of colour: the result looks like
        // the frontmost operand because that is the one that was on top, and
        // the one whose colour you were already looking at.
        fill: { ...front.fill },
        stroke: { ...front.stroke },
        // Stated in artboard units like everything else about the result, so an
        // operand lifted out of a scaled group keeps the width it was drawn at.
        strokeWidth: front.strokeWidth * plan.front.frame.scale,
        opacity: front.opacity,
        // The operands were flattened into artboard units before the operation,
        // so there is no turn and no frame left over to carry.
        rotation: 0,
        hidden: false,
        locked: false,
      };
      return {
        ...state,
        // One entry for the whole thing: pressing Union once is one thing the
        // user did, however many shapes went into it.
        ...remember(state, `${action.op} ${subjectOf(state, action.ids)}`),
        doc: {
          ...state.doc,
          objects: [
            ...plan.remaining.slice(0, plan.index),
            result,
            ...plan.remaining.slice(plan.index),
          ],
        },
        selectedIds: new Set([result.id]),
        selectedNode: null,
        // The result is a top-level object, so there is no group left to be
        // standing inside — the same rule `selectObject` follows.
        entered: [],
        sequence,
      };
    }

    // ----- history --------------------------------------------------------
    case 'undo': {
      const entry = state.past.at(-1);
      if (!entry) return state;
      return {
        ...state,
        doc: entry.doc,
        selectedIds: entry.selectedIds,
        // The document that comes back may not have the node that was selected
        // in it at all — undoing the addition of one is the obvious case. The
        // same is true of the group you were standing inside, which is why the
        // entered path is cut back to what still exists rather than trusted.
        selectedNode: null,
        entered: prunedEntry(entry.doc.objects, state.entered),
        past: state.past.slice(0, -1),
        future: [
          ...state.future,
          { doc: state.doc, selectedIds: state.selectedIds, label: entry.label },
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
        selectedIds: entry.selectedIds,
        selectedNode: null,
        entered: prunedEntry(entry.doc.objects, state.entered),
        past: [
          ...state.past,
          { doc: state.doc, selectedIds: state.selectedIds, label: entry.label },
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
        selectedIds: new Set([object.id]),
        selectedNode: null,
        sequence,
      };
    }
    case 'deleteObjects': {
      const removing = new Set(action.ids);
      // Nothing named, nothing to answer for: a history entry here would be an
      // undo that appears to do nothing.
      if (removing.size === 0) return state;
      // A group goes with everything in it. Nothing here says so: taking the
      // node out of the tree takes its children with it, which is the one
      // behaviour a tree gives away for free.
      const objects = withoutNodes(state.doc.objects, removing);
      return {
        ...state,
        ...remember(state, `delete ${subjectOf(state, action.ids)}`),
        doc: { ...state.doc, objects },
        selectedIds: new Set([...state.selectedIds].filter((id) => !removing.has(id))),
        selectedNode: null,
        entered: prunedEntry(objects, state.entered),
      };
    }
    case 'duplicateObject': {
      const source = findNode(state.doc.objects, action.id);
      if (!source) return state;
      // A copy is a new node, not a second reference: `structuredClone` rather
      // than a spread, or the two would share one geometry and one colour pair
      // and editing either would move both. Every node in the copied subtree
      // then takes a fresh id, because an id names one node in the whole tree
      // and a duplicated group would otherwise hand back a second `rect 1`.
      const renamed = reidentified(structuredClone(source), state.sequence);
      const copy: IconNode = {
        ...renamed.node,
        name: `${source.name} copy`,
        // A duplicate arrives unlocked whatever the original was, because it
        // was made to be moved.
        locked: false,
      };
      const { parentId, list } = siblings(state.doc.objects, action.id);
      const at = list.findIndex((node) => node.id === action.id);
      return {
        ...state,
        ...remember(state, `duplicate ${source.name}`),
        doc: {
          ...state.doc,
          objects: mapList(state.doc.objects, parentId, (current) => {
            const next = current.slice();
            next.splice(at, 0, copy);
            return next;
          }),
        },
        selectedIds: new Set([copy.id]),
        selectedNode: null,
        sequence: renamed.sequence,
      };
    }
    // Name, visibility and lock are the three things a group and a shape both
    // have, so all three reach a node of either kind without asking which.
    case 'renameObject':
      return {
        ...state,
        ...remember(state, `rename ${nameOf(state, action.id)}`),
        doc: withNode(state.doc, action.id, (node) => ({ ...node, name: action.name })),
      };
    case 'toggleHidden': {
      const node = findNode(state.doc.objects, action.id);
      const label = `${node?.hidden ? 'show' : 'hide'} ${nameOf(state, action.id)}`;
      return {
        ...state,
        ...remember(state, label),
        doc: withNode(state.doc, action.id, (o) => ({ ...o, hidden: !o.hidden })),
      };
    }
    case 'toggleLocked': {
      const node = findNode(state.doc.objects, action.id);
      const label = `${node?.locked ? 'unlock' : 'lock'} ${nameOf(state, action.id)}`;
      return {
        ...state,
        ...remember(state, label),
        doc: withNode(state.doc, action.id, (o) => ({ ...o, locked: !o.locked })),
      };
    }
    case 'reorderObjects': {
      const list = listAt(state.doc.objects, action.parentId);
      const { from, to } = action;
      // A move to where it already is, or off either end of the list it is in,
      // is not an edit — and a history entry for it would be an undo that
      // appears to do nothing. Off the end of a *group* is a dead end for the
      // same reason it is at the top level: there is no "after the back".
      if (!list || from === to) return state;
      if (from < 0 || from >= list.length || to < 0 || to >= list.length) return state;
      const objects = mapList(state.doc.objects, action.parentId, (current) =>
        moveWithin(current, from, to),
      );
      return { ...state, ...remember(state, 'reorder'), doc: { ...state.doc, objects } };
    }

    // ----- direct manipulation -------------------------------------------
    case 'moveObject': {
      const label = `move ${nameOf(state, action.id)}`;
      const node = findNode(state.doc.objects, action.id);
      if (!node) return state;
      // A group moves by its transform and a shape by its coordinates, and both
      // are "move this by that much" — so one action means both rather than the
      // rail and the keyboard having to know which they are holding.
      const doc =
        isGroup(node)
          ? mapTransform(state.doc, action.id, (g) => ({
              ...g.transform,
              x: g.transform.x + action.dx,
              y: g.transform.y + action.dy,
            }))
          : mapGeometry(state.doc, action.id, (o) => translate(o.geometry, action.dx, action.dy));
      return {
        ...state,
        ...remember(state, label, { key: `move:${action.id}`, at: action.at ?? 0 }),
        doc,
      };
    }
    case 'setGeometry':
      return {
        ...state,
        ...remember(state, action.label, { key: `geometry:${action.id}`, at: action.at ?? 0 }),
        doc: mapGeometry(state.doc, action.id, () => action.geometry),
      };
    case 'setPlacements': {
      if (action.edits.length === 0) return state;
      // Keyed by everything the batch touches, so a drag of the same three
      // nodes coalesces into one entry and a drag of a different three does not
      // fold into it. A batch of one produces the key `setGeometry` does, which
      // is what lets a single drag stay one gesture across the change.
      const key = `geometry:${action.edits.map((edit) => edit.id).join(',')}`;
      return {
        ...state,
        ...remember(state, action.label, { key, at: action.at ?? 0 }),
        doc: action.edits.reduce(
          (doc, edit) =>
            'geometry' in edit
              ? mapGeometry(doc, edit.id, () => edit.geometry)
              : mapTransform(doc, edit.id, () => edit.transform),
          state.doc,
        ),
      };
    }
    case 'resizeObject': {
      const label = `resize ${nameOf(state, action.id)}`;
      return {
        ...state,
        ...remember(state, label, { key: `resize:${action.id}`, at: action.at ?? 0 }),
        doc: mapGeometry(state.doc, action.id, (o) => fitToBox(o, action.box)),
      };
    }
    case 'resizeGroup': {
      const group = findNode(state.doc.objects, action.id);
      if (!group || !isGroup(group)) return state;
      const inside = contentBox(group);
      // A group with nothing in it, or with everything in it stacked on one
      // point, has no width for a ratio to be taken against. Refusing is the
      // whole answer — there is no size there to change.
      if (inside.w <= 0 || action.box.w <= 0) return state;
      const frame = frameOf(state.doc.objects, action.id);
      const wanted = action.box.w / inside.w / frame.scale;
      const centre = unplace(frame, boxCentre(action.box));
      return {
        ...state,
        ...remember(state, `resize ${group.name}`, {
          key: `resize:${action.id}`,
          at: action.at ?? 0,
        }),
        doc: mapTransform(state.doc, action.id, (g) =>
          transformAt(g, centre, g.transform.rotation, wanted),
        ),
      };
    }
    case 'setGroupTransform':
      return {
        ...state,
        ...remember(state, `place ${nameOf(state, action.id)}`),
        doc: mapTransform(state.doc, action.id, () => action.transform),
      };
    case 'insertVertex': {
      const object = shapeById(state.doc, action.id);
      if (!object || isLocked(state.doc.objects, action.id)) return state;
      const added = insertVertex(object, action.at, action.reach);
      // Nothing near enough to the outline, or a shape with no nodes to add
      // one to. Doing nothing is the whole answer — a history entry for an
      // edit that did not happen would be an undo that appears to do nothing.
      if (!added) return state;
      return {
        ...state,
        ...remember(state, `add point to ${object.name}`),
        doc: mapGeometry(state.doc, action.id, () => added.geometry),
        // The object is selected too, and *only* it: a double-click lands on
        // the outline, and a filled shape's hit test excludes its own boundary
        // — so the press that opens the gesture deselects, and without this the
        // new node would belong to nothing visible and no handles would be
        // drawn to drag it by. Node editing needs the shape alone, so this
        // replaces the selection rather than joining it.
        selectedIds: new Set([action.id]),
        selectedNode: { id: action.id, index: added.index },
      };
    }
    case 'removeVertex': {
      const object = shapeById(state.doc, action.id);
      if (!object || isLocked(state.doc.objects, action.id)) return state;
      const geometry = removeVertex(object, action.index);
      // At the floor for its kind: the key does nothing, and in particular it
      // does not fall through to deleting the object.
      if (!geometry) return state;
      return {
        ...state,
        ...remember(state, `remove point from ${object.name}`),
        doc: mapGeometry(state.doc, action.id, () => geometry),
        selectedNode: null,
      };
    }
    case 'rotateObject': {
      const label = `rotate ${nameOf(state, action.id)}`;
      const turn = ((action.degrees % 360) + 360) % 360;
      if (isLocked(state.doc.objects, action.id)) return state;
      return {
        ...state,
        ...remember(state, label, { key: `rotate:${action.id}`, at: action.at ?? 0 }),
        // Stated in the node's own frame, which for a group means its parent's
        // — the same frame its `x` and `y` are in, and the same one the
        // properties rail shows. A group inside a turned group carries only the
        // part of the turn it is answerable for.
        doc: withNode(state.doc, action.id, (node) =>
          isGroup(node)
            ? { ...node, transform: { ...node.transform, rotation: turn } }
            : { ...node, rotation: turn },
        ),
      };
    }

    // ----- appearance -----------------------------------------------------
    //
    // Each of these takes every object it is asked for in one entry. An edit
    // made once, in one field, with a whole selection under it, is one thing
    // the user did — however many shapes it landed on.
    case 'setOpacity': {
      const opacity = Math.max(0, Math.min(100, Math.round(action.opacity)));
      return {
        ...state,
        ...remember(state, `opacity ${subjectOf(state, action.ids)}`, {
          key: `opacity:${action.ids.join(',')}`,
          at: action.at ?? 0,
        }),
        // Opacity is the one appearance property a group has of its own, so
        // this is the one that reaches a node of either kind.
        doc: action.ids.reduce(
          (doc, id) => withNode(doc, id, (node) => ({ ...node, opacity })),
          state.doc,
        ),
      };
    }
    case 'setStrokeWidth': {
      const strokeWidth = Math.max(0, snapTo(action.width, state.doc.snap));
      return {
        ...state,
        ...remember(state, `stroke ${subjectOf(state, action.ids)}`),
        doc: mapShapes(state.doc, action.ids, (o) => ({ ...o, strokeWidth })),
      };
    }
    // Both reach a node of either kind, like `setOpacity` and unlike a fill: a
    // shadow is thrown by an outline rather than by a paint, and a group has
    // exactly one outline however many shapes are inside it.
    case 'setBlur': {
      const blur = Math.max(0, action.blur);
      return {
        ...state,
        // One entry, whatever it lands on: setting a blur is one edit in one
        // field, the same as setting a colour.
        ...remember(state, `blur ${subjectOf(state, action.ids)}`),
        doc: action.ids.reduce(
          (doc, id) =>
            withNode(doc, id, (node) => (blur > 0 ? { ...node, blur } : withoutEffect(node, 'blur'))),
          state.doc,
        ),
      };
    }
    case 'setShadow': {
      const shadow = action.shadow;
      return {
        ...state,
        ...remember(state, `${shadow === null ? 'no shadow' : 'shadow'} ${subjectOf(state, action.ids)}`),
        doc: action.ids.reduce(
          (doc, id) =>
            withNode(doc, id, (node) =>
              shadow === null ? withoutEffect(node, 'shadow') : { ...node, shadow },
            ),
          state.doc,
        ),
      };
    }
    case 'setColor': {
      const label = `${action.channel} ${subjectOf(state, action.ids)}`;
      const half = (pair: Pair): Pair => ({ ...pair, [action.ground]: action.hex });
      return {
        ...state,
        ...remember(state, label),
        doc: mapShapes(state.doc, action.ids, (o) =>
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
      // Through the whole tree: a shape inside a group is stated in the group's
      // frame, and that frame is what its own numbers are drawn on.
      const onGrid = (nodes: readonly IconNode[]): IconNode[] =>
        nodes.map((node) =>
          isGroup(node)
            ? {
                ...node,
                transform: snapTransform(node.transform, snap),
                children: onGrid(node.children),
              }
            : {
                ...node,
                geometry: snapGeometry(node.geometry, snap),
                strokeWidth: snapTo(node.strokeWidth, snap),
              },
        );
      // Re-snapping what is already there is the point: changing the step to 8
      // and leaving everything on halves would mean the grid describes what
      // will happen next rather than what the document is.
      return {
        ...state,
        ...remember(state, `step ${snap}`),
        doc: { ...state.doc, snap, objects: onGrid(state.doc.objects) },
      };
    }

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

/** The list a node sits in, and which group owns it. */
function siblings(
  nodes: readonly IconNode[],
  id: string,
): { list: readonly IconNode[]; parentId: string | null } {
  const parent = ancestorsOf(nodes, id).at(-1);
  return { list: parent ? parent.children : nodes, parentId: parent?.id ?? null };
}

/**
 * Every node of a copied subtree with a fresh id, and the sequence left over.
 *
 * Names are left exactly as they were and only the ids change, because a name
 * is what you called the thing and a duplicate of `wheel` is still a wheel —
 * only the copy's own root is renamed, by the caller, and only so the two rows
 * can be told apart.
 */
function reidentified(node: IconNode, sequence: number): { node: IconNode; sequence: number } {
  const next = sequence + 1;
  if (!isGroup(node)) return { node: { ...node, id: objectId(node.geometry.kind, next) }, sequence: next };
  let running = next;
  const children: IconNode[] = [];
  for (const child of node.children) {
    const done = reidentified(child, running);
    children.push(done.node);
    running = done.sequence;
  }
  return { node: { ...node, id: groupId(next), children }, sequence: running };
}

/**
 * The document with the selection collected into one group, or null when there
 * is nothing to collect.
 *
 * **Where the group lands: the frontmost member's place.** Objects picked out
 * of a list are almost never next to each other, so collecting them has to move
 * something past something else, and the only question is which direction. Put
 * the group at the frontmost member's index and every member either stays where
 * it was or comes *forward* — no member ever ends up behind something it was in
 * front of. Put it at the backmost member's index instead and the opposite
 * happens: parts of what you just selected disappear behind objects you did not
 * select. Grouping is how you take hold of something, and it must not hide any
 * of what you took hold of.
 *
 * Members are taken from one list only — the frontmost member's. A selection
 * that reaches inside a group and outside it at the same time has no single
 * list to be collected into, and quietly pulling objects out of a group is a
 * restructuring nobody asked ⌘G for.
 */
function grouped(state: EditorState): { objects: IconNode[]; group: IconGroup } | null {
  const chosen = new Set(state.selectedIds);
  if (chosen.size === 0) return null;
  const level = levelOf(state.doc.objects, state.entered);
  const front = level.list.findIndex((node) => chosen.has(node.id));
  if (front < 0) return null;

  const members = level.list.filter((node) => chosen.has(node.id));
  const group: IconGroup = {
    id: groupId(state.sequence + 1),
    name: `group ${state.sequence + 1}`,
    // Nothing is moved by being grouped, so the transform is the identity and
    // the children keep the very coordinates they had: they were already stated
    // in this list's frame, and the group's own frame starts out as that frame.
    transform: { ...NO_TRANSFORM },
    opacity: 100,
    hidden: false,
    locked: false,
    children: members,
  };
  const objects = mapList(state.doc.objects, level.parentId, (list) => {
    const kept: IconNode[] = [];
    for (const node of list) {
      if (!chosen.has(node.id)) {
        kept.push(node);
        continue;
      }
      // The frontmost member's slot is where the group goes; the rest leave a
      // hole behind them.
      if (node.id === members[0]?.id) kept.push(group);
    }
    return kept;
  });
  return { objects, group };
}

export const canUndo = (state: EditorState): boolean => state.past.length > 0;
export const canRedo = (state: EditorState): boolean => state.future.length > 0;

/**
 * The one selected node — a shape or a group — or null when nothing is selected
 * and equally when more than one thing is.
 */
export function selectedNodeOnly(state: EditorState): IconNode | null {
  const id = sole(state.selectedIds);
  return id === null ? null : findNode(state.doc.objects, id);
}

/** Everything selected, in the order it was selected, groups included. */
export function selectedNodes(state: EditorState): IconNode[] {
  const nodes: IconNode[] = [];
  for (const id of state.selectedIds) {
    const node = findNode(state.doc.objects, id);
    if (node) nodes.push(node);
  }
  return nodes;
}

/** The frame the one selected node's own coordinates are stated in. */
export function selectedFrame(state: EditorState): Placement {
  const id = sole(state.selectedIds);
  return id === null ? ARTBOARD_FRAME : frameOf(state.doc.objects, id);
}

/** Whether the node, or any group above it, is locked. */
export function lockedInPlace(state: EditorState, id: string): boolean {
  return isLocked(state.doc.objects, id);
}

/**
 * The one selected object, or null — when nothing is selected, and equally
 * when more than one thing is.
 *
 * This is the single-selection accessor, and the reason no caller counts the
 * selection itself. The geometry fields, the shape-specific group, node
 * editing and the rotate knob all mean *the* selected object, and every one of
 * them is meaningless for a selection of two: X is not a property two shapes
 * share, and a node is a place inside one of them. Answering null puts that
 * judgement in one place instead of a `size === 1` in each of theirs.
 */
export function selectedObject(state: EditorState): IconObject | null {
  const node = selectedNodeOnly(state);
  // A group is not one of these either. Everything below this accessor — the
  // geometry fields, the node handles, the rotate knob's pivot — is a statement
  // about a shape, and a group answers none of them the same way.
  return node === null || isGroup(node) ? null : node;
}

/**
 * Everything selected, in the order it was selected — which is the order a
 * boolean operation will read its operands in.
 *
 * Ids that name nothing are dropped rather than reported as gaps: the
 * selection is not part of the document, so an undo can hand back a document
 * an id in it no longer names.
 */
export function selectedObjects(state: EditorState): IconObject[] {
  return selectedNodes(state).filter((node): node is IconObject => !isGroup(node));
}

/**
 * Which node of the selected object is selected, or null.
 *
 * Checked against what is actually there rather than trusted: an index is only
 * meaningful beside the shape it was taken from, and a shape can lose points
 * while one of them is selected. Validating on the way out means no other case
 * in the reducer has to remember to clear it.
 */
export function selectedNodeIndex(state: EditorState): number | null {
  const node = state.selectedNode;
  const object = selectedObject(state);
  if (!node || !object || node.id !== object.id) return null;
  return node.index >= 0 && node.index < vertexPoints(object).length ? node.index : null;
}

/**
 * One box round everything selected, or null — what the artboard outlines when
 * there are several.
 *
 * Measured on each object's rotated box, because a combined outline is upright
 * and has to hold what is actually drawn: the objects inside it each have a
 * rotation of their own, and the box round them has none it could carry.
 * Hidden objects are left out of it — they can be selected from the rail, and
 * an outline round something invisible describes nothing.
 */
export function selectionBounds(state: EditorState): Box | null {
  return unionBox(
    selectedNodes(state)
      .filter((node) => !node.hidden)
      .map((node) => boxThrough(localBounds(node), frameOf(state.doc.objects, node.id))),
  );
}

/** The outline and the angle to draw it at for the one selected node. */
export function selectionOutline(state: EditorState): { box: Box; rotation: number } | null {
  const node = selectedNodeOnly(state);
  if (!node || node.hidden) return null;
  return outlineOf(node, frameOf(state.doc.objects, node.id));
}
