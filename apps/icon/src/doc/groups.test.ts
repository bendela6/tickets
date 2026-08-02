import { describe, expect, it } from 'vitest';
import { renderSvg } from '../render/svg';
import { emptyDocument, newObject } from './defaults';
import { bounds } from './geometry';
import { editorReducer, initialState, type Action, type EditorState } from './store';
import {
  everyShape,
  frameOf,
  isGroup,
  nodeAt,
  nodesInBox,
  place,
  shapeAt,
  visibleShapes,
} from './tree';
import type { IconGroup, IconNode, IconObject } from './types';

const start = () => initialState(emptyDocument('test'));

function run(state: EditorState, ...actions: Action[]): EditorState {
  return actions.reduce(editorReducer, state);
}

/** The one group in the document, wherever it is. */
function groupIn(nodes: readonly IconNode[]): IconGroup {
  for (const node of nodes) {
    if (isGroup(node)) return node;
  }
  throw new Error('no group in the document');
}

const shapeNamed = (state: EditorState, name: string): IconObject => {
  const found = everyShape(state.doc.objects).find((shape) => shape.name === name);
  if (!found) throw new Error(`no shape called ${name}`);
  return found;
};

/**
 * Two rectangles a hundred apart, both selected. `rect 2` is frontmost, since
 * every new shape lands in front of the last.
 */
function twoSelected(): EditorState {
  const state = run(
    start(),
    { type: 'addObject', kind: 'rect' },
    { type: 'addObject', kind: 'rect' },
    { type: 'selectAll' },
  );
  return state;
}

/** Where a shape actually sits on the artboard, through however many groups. */
function onArtboard(state: EditorState, name: string): { x: number; y: number } {
  const shape = shapeNamed(state, name);
  return place(frameOf(state.doc.objects, shape.id), bounds(shape));
}

describe('grouping', () => {
  it('grouping two objects and ungrouping them returns the document to what it was', () => {
    const before = twoSelected();
    const after = run(before, { type: 'groupSelection' }, { type: 'ungroupSelection' });
    expect(after.doc).toEqual(before.doc);
  });

  it('puts the group where the frontmost member was, so no member falls behind anything', () => {
    // Three shapes, and the middle one left out: grouping the outer two must
    // not drop either of them behind the one that was between them.
    const state = run(
      start(),
      { type: 'addObject', kind: 'rect' },
      { type: 'addObject', kind: 'circle' },
      { type: 'addObject', kind: 'ellipse' },
    );
    const [front, , back] = state.doc.objects;
    if (!front || !back) throw new Error('expected three objects');
    const grouped = run(
      state,
      { type: 'selectObject', id: front.id },
      { type: 'toggleSelect', id: back.id },
      { type: 'groupSelection' },
    );
    // The group took slot 0 — the frontmost member's — and the circle that was
    // between them is now behind it rather than in front of half of it.
    expect(grouped.doc.objects.map((node) => (isGroup(node) ? 'group' : node.name))).toEqual([
      'group',
      'circle 2',
    ]);
    expect(groupIn(grouped.doc.objects).children.map((child) => child.name)).toEqual([
      'ellipse 3',
      'rect 1',
    ]);
  });

  it('a fresh group carries no transform, so nothing on the artboard moves', () => {
    const before = twoSelected();
    const after = editorReducer(before, { type: 'groupSelection' });
    expect(groupIn(after.doc.objects).transform).toEqual({ x: 0, y: 0, rotation: 0, scale: 1 });
    expect(renderSvg(after.doc, { ground: 'light', background: false })).toContain(
      '<rect x="136" y="136"',
    );
  });

  it('one undo takes the whole grouping back', () => {
    const before = twoSelected();
    const after = run(before, { type: 'groupSelection' }, { type: 'undo' });
    expect(after.doc).toEqual(before.doc);
  });

  it('deleting a group takes everything inside it', () => {
    const grouped = editorReducer(twoSelected(), { type: 'groupSelection' });
    const group = groupIn(grouped.doc.objects);
    const gone = editorReducer(grouped, { type: 'deleteObjects', ids: [group.id] });
    expect(gone.doc.objects).toEqual([]);
    expect(everyShape(gone.doc.objects)).toEqual([]);
  });

  it('duplicating a group copies every node inside it under a new id', () => {
    const grouped = editorReducer(twoSelected(), { type: 'groupSelection' });
    const group = groupIn(grouped.doc.objects);
    const copied = editorReducer(grouped, { type: 'duplicateObject', id: group.id });
    const ids = [...copied.doc.objects.flatMap((node) => (isGroup(node) ? node.children : node))].map(
      (node) => node.id,
    );
    expect(new Set(ids).size).toBe(ids.length);
    expect(everyShape(copied.doc.objects)).toHaveLength(4);
  });
});

describe('a group’s transform', () => {
  /** A group holding one rect, with the transform under test. */
  function placed(transform: Partial<IconGroup['transform']>): EditorState {
    const grouped = run(start(), { type: 'addObject', kind: 'rect' }, { type: 'selectAll' }, {
      type: 'groupSelection',
    });
    const group = groupIn(grouped.doc.objects);
    return editorReducer(grouped, {
      type: 'setGroupTransform',
      id: group.id,
      transform: { ...group.transform, ...transform },
    });
  }

  it('a child’s world position composes its parents’ transforms', () => {
    const state = placed({ x: 40, y: 20 });
    // The rect preset lands at 136, 136 on a 512 board.
    expect(onArtboard(state, 'rect 1')).toMatchObject({ x: 176, y: 156 });
  });

  it('composes two levels, not just one', () => {
    const outer = placed({ x: 40, y: 0 });
    const group = groupIn(outer.doc.objects);
    // Wrap the group in a second one and move that too.
    const nested = run(
      outer,
      { type: 'selectObject', id: group.id },
      { type: 'groupSelection' },
    );
    const top = groupIn(nested.doc.objects);
    const moved = editorReducer(nested, {
      type: 'setGroupTransform',
      id: top.id,
      transform: { ...top.transform, x: 5, y: 7 },
    });
    expect(onArtboard(moved, 'rect 1')).toMatchObject({ x: 181, y: 143 });
  });

  it('moving a group moves every child, and moves the group rather than them', () => {
    const grouped = editorReducer(twoSelected(), { type: 'groupSelection' });
    const group = groupIn(grouped.doc.objects);
    const before = grouped.doc.objects;
    const moved = editorReducer(grouped, { type: 'moveObject', id: group.id, dx: 30, dy: 10 });
    expect(groupIn(moved.doc.objects).transform).toMatchObject({ x: 30, y: 10 });
    // Every child sits 30 across and 10 down of where it did, and not one of
    // their own geometries was touched.
    expect(everyShape(moved.doc.objects).map((s) => s.geometry)).toEqual(
      everyShape(before).map((s) => s.geometry),
    );
    for (const { shape, frame } of visibleShapes(moved.doc.objects)) {
      expect(place(frame, bounds(shape))).toMatchObject({ x: 166, y: 146 });
      expect(shape.id).toBeTruthy();
    }
  });

  it('a turn is about the group’s own centre, so the group stays where it is', () => {
    const state = placed({ rotation: 90 });
    // A square turned a quarter about its own middle occupies the same box.
    const shape = shapeNamed(state, 'rect 1');
    const world = place(frameOf(state.doc.objects, shape.id), bounds(shape));
    expect(world.x).toBeCloseTo(376, 6);
    expect(world.y).toBeCloseTo(136, 6);
  });

  it('a scale is one number, so a group cannot be stretched on one axis alone', () => {
    const state = placed({ scale: 2 });
    const group = groupIn(state.doc.objects);
    // There is no second field to set. What the model holds is the whole of
    // what a group resize may do, and it applies to both axes at once.
    expect(Object.keys(group.transform).sort()).toEqual(['rotation', 'scale', 'x', 'y']);
    expect(group.transform.scale).toBe(2);
  });

  it('resizing a group changes its scale and leaves its children’s numbers alone', () => {
    const grouped = editorReducer(twoSelected(), { type: 'groupSelection' });
    const group = groupIn(grouped.doc.objects);
    const before = everyShape(grouped.doc.objects).map((shape) => shape.geometry);
    // The two rects occupy the same 240-square box, so doubling it is a scale
    // of two whichever way it is asked for.
    const bigger = editorReducer(grouped, {
      type: 'resizeGroup',
      id: group.id,
      box: { x: 136, y: 136, w: 480, h: 480 },
    });
    expect(groupIn(bigger.doc.objects).transform.scale).toBe(2);
    expect(everyShape(bigger.doc.objects).map((shape) => shape.geometry)).toEqual(before);
  });

  it('a child’s stroke scales with the group, because `<g>` is what draws it', () => {
    const grouped = run(
      start(),
      { type: 'addObject', kind: 'line' },
      { type: 'selectAll' },
      { type: 'groupSelection' },
    );
    const group = groupIn(grouped.doc.objects);
    const scaled = editorReducer(grouped, {
      type: 'setGroupTransform',
      id: group.id,
      transform: { ...group.transform, scale: 2 },
    });
    const svg = renderSvg(scaled.doc, { ground: 'light', background: false });
    // The width written in the file is untouched — the `scale(2)` above it is
    // what doubles the stroke that gets drawn. That is SVG's own rule, and the
    // model does not fight it: dividing every descendant's width back out on
    // every render would make the artboard disagree with the exported file,
    // which is the one thing a single renderer exists to prevent.
    expect(svg).toContain('scale(2)');
    expect(svg).toContain('stroke-width="20"');
  });

  it('ungrouping a scaled group hands the scale to the children, strokes included', () => {
    const grouped = run(
      start(),
      { type: 'addObject', kind: 'line' },
      { type: 'selectAll' },
      { type: 'groupSelection' },
    );
    const group = groupIn(grouped.doc.objects);
    const width = everyShape(grouped.doc.objects)[0]?.strokeWidth ?? 0;
    const scaled = editorReducer(grouped, {
      type: 'setGroupTransform',
      id: group.id,
      transform: { ...group.transform, scale: 2 },
    });
    const freed = run(scaled, { type: 'selectObject', id: group.id }, { type: 'ungroupSelection' });
    expect(everyShape(freed.doc.objects)[0]?.strokeWidth).toBe(width * 2);
  });

  it('ungrouping a moved group leaves the picture exactly where it was', () => {
    const state = placed({ x: 40, y: 20 });
    const group = groupIn(state.doc.objects);
    const before = renderSvg(state.doc, { ground: 'light', background: false });
    const freed = run(state, { type: 'selectObject', id: group.id }, { type: 'ungroupSelection' });
    const after = renderSvg(freed.doc, { ground: 'light', background: false });
    // The same rectangle, at the same place — one drawn inside a `<g>` and one
    // not, which is the only difference between the two files.
    expect(after).toContain('<rect x="176" y="156"');
    expect(before).toContain('<g transform="translate(40 20)">');
    expect(after).not.toContain('<g');
  });
});

describe('hit-testing and visibility through a group', () => {
  /** A rect inside a group inside a group, the outer one moved 40 across. */
  function twoLevels(): EditorState {
    const inner = run(
      start(),
      { type: 'addObject', kind: 'rect' },
      { type: 'selectAll' },
      { type: 'groupSelection' },
    );
    const nested = run(
      inner,
      { type: 'selectObject', id: groupIn(inner.doc.objects).id },
      { type: 'groupSelection' },
    );
    const outer = groupIn(nested.doc.objects);
    return editorReducer(nested, {
      type: 'setGroupTransform',
      id: outer.id,
      transform: { ...outer.transform, x: 40, y: 0 },
    });
  }

  it('hit-testing finds a child through two levels', () => {
    const state = twoLevels();
    // The rect sits at 136–376; the outer group has carried it 40 across.
    const found = shapeAt(state.doc.objects, { x: 200, y: 200 });
    expect(found?.shape.name).toBe('rect 1');
    // And it is not found where it used to be, which is what says the frames
    // are being read rather than the stored numbers.
    expect(shapeAt(state.doc.objects, { x: 150, y: 200 })).toBeNull();
  });

  it('clicking selects the outermost group, not the shape inside it', () => {
    const state = twoLevels();
    const outer = groupIn(state.doc.objects);
    expect(nodeAt(state.doc.objects, { x: 200, y: 200 }, [])?.id).toBe(outer.id);
    // One level in, the click finds what is at that level — the inner group.
    const inner = outer.children[0];
    expect(nodeAt(state.doc.objects, { x: 200, y: 200 }, [outer.id])?.id).toBe(inner?.id);
    // Two levels in, the shape itself.
    expect(
      nodeAt(state.doc.objects, { x: 200, y: 200 }, [outer.id, inner?.id ?? ''])?.name,
    ).toBe('rect 1');
  });

  it('a hidden group hides its children', () => {
    const grouped = editorReducer(twoSelected(), { type: 'groupSelection' });
    const group = groupIn(grouped.doc.objects);
    const hidden = editorReducer(grouped, { type: 'toggleHidden', id: group.id });
    expect(visibleShapes(hidden.doc.objects)).toEqual([]);
    expect(renderSvg(hidden.doc, { ground: 'light', background: false })).not.toContain('<rect');
    // The children are still there and still say they are visible themselves —
    // it is the group above them that is not being drawn.
    expect(everyShape(hidden.doc.objects).every((shape) => !shape.hidden)).toBe(true);
  });

  it('a locked group’s children do not move', () => {
    const grouped = editorReducer(twoSelected(), { type: 'groupSelection' });
    const group = groupIn(grouped.doc.objects);
    const child = group.children[0];
    if (!child) throw new Error('expected a child');
    const locked = editorReducer(grouped, { type: 'toggleLocked', id: group.id });
    const shoved = run(
      locked,
      { type: 'moveObject', id: child.id, dx: 50, dy: 50 },
      { type: 'moveObject', id: group.id, dx: 50, dy: 50 },
    );
    expect(shoved.doc.objects).toEqual(locked.doc.objects);
  });
});

/**
 * Picking things off the artboard, on a flat list.
 *
 * These rules used to live on `hitTest` and `objectsInBox`, which took a list
 * of shapes and could not be handed a tree. `shapeAt` and `nodesInBox` are the
 * same rules read through a frame, and a document with no groups in it is the
 * case where the frame is the identity — so this is where they are stated.
 */
describe('picking things off the artboard', () => {
  const square = (id: string, at: number): IconObject => ({
    ...newObject('rect', 1, { width: 512, height: 512 }),
    id,
    geometry: { kind: 'rect', x: at, y: at, w: 100, h: 100, radius: 0 },
  });

  const near = square('near', 0);
  const far = square('far', 300);
  /** A band across the gap: over a corner of the far square, nowhere near the other. */
  const BAND = { x: 250, y: 250, w: 100, h: 100 };
  const MIDDLE = { x: 50, y: 50 };

  it('takes the frontmost shape, which is the first in document order', () => {
    expect(shapeAt([near, { ...far, geometry: near.geometry, id: 'back' }], MIDDLE)?.shape.id).toBe(
      'near',
    );
  });

  it('skips a hidden shape — it is not there to be hit', () => {
    const back = { ...near, id: 'back' };
    expect(shapeAt([{ ...near, hidden: true }, back], MIDDLE)?.shape.id).toBe('back');
  });

  it('still hits a locked shape, so it can be selected and unlocked', () => {
    expect(shapeAt([{ ...near, locked: true }], MIDDLE)?.shape.id).toBe('near');
  });

  it('finds nothing on empty ground', () => {
    expect(shapeAt([near], { x: 400, y: 400 })).toBeNull();
    expect(nodeAt([near], { x: 400, y: 400 }, [])).toBeNull();
  });

  it('a band catches what it overlaps, without having to contain it', () => {
    expect(nodesInBox([near, far], BAND, []).map((node) => node.id)).toEqual(['far']);
  });

  it('a band takes them front to back, the order the document is in', () => {
    expect(
      nodesInBox([near, far], { x: 0, y: 0, w: 512, h: 512 }, []).map((node) => node.id),
    ).toEqual(['near', 'far']);
  });

  it('a band skips a hidden object and still takes a locked one', () => {
    expect(nodesInBox([{ ...far, hidden: true }], BAND, [])).toEqual([]);
    expect(nodesInBox([{ ...far, locked: true }], BAND, []).map((node) => node.id)).toEqual(['far']);
  });

  it('a band measures a turned shape by where it actually lands', () => {
    // Turned 45° about its own centre at 350, the square's corners swing out
    // past the box it is stored as — and this band only reaches 290.
    const corner = { x: 280, y: 340, w: 10, h: 10 };
    expect(nodesInBox([{ ...far, rotation: 45 }], corner, []).map((node) => node.id)).toEqual([
      'far',
    ]);
    expect(nodesInBox([far], corner, [])).toEqual([]);
  });

  it('a band catches nothing on empty ground', () => {
    expect(nodesInBox([near, far], { x: 150, y: 150, w: 50, h: 50 }, [])).toEqual([]);
  });
});

describe('a document with no groups', () => {
  const flat = () =>
    run(
      start(),
      { type: 'addObject', kind: 'rect' },
      { type: 'addObject', kind: 'circle' },
      { type: 'addObject', kind: 'line' },
    );

  it('renders without a single `<g>` in it', () => {
    const svg = renderSvg(flat().doc, { ground: 'light', background: false });
    expect(svg).not.toContain('<g');
    expect(svg).not.toContain('</g>');
  });

  it('is already a valid tree, so nothing walks it differently', () => {
    const state = flat();
    expect(everyShape(state.doc.objects)).toEqual(state.doc.objects);
    expect(visibleShapes(state.doc.objects).map((placed) => placed.frame)).toEqual([
      { scale: 1, rotation: 0, x: 0, y: 0 },
      { scale: 1, rotation: 0, x: 0, y: 0 },
      { scale: 1, rotation: 0, x: 0, y: 0 },
    ]);
  });

  it('never leaves a level, because there is none to be in', () => {
    const state = flat();
    expect(state.entered).toEqual([]);
    expect(editorReducer(state, { type: 'exitGroup' })).toBe(state);
  });

  it('is untouched by ⌘G with nothing selected and by ⇧⌘G with no group in it', () => {
    const state = run(flat(), { type: 'selectObject', id: null });
    expect(editorReducer(state, { type: 'groupSelection' })).toBe(state);
    const all = run(flat(), { type: 'selectAll' });
    expect(editorReducer(all, { type: 'ungroupSelection' })).toBe(all);
  });
});
