import { describe, expect, it } from 'vitest';
import { emptyDocument } from './defaults';
import { bounds } from './geometry';
import {
  canRedo,
  canUndo,
  editorReducer,
  initialState,
  selectedObject,
  type Action,
  type EditorState,
} from './store';

const start = () => initialState(emptyDocument('test'));

/** Apply a run of actions, so a test reads as the sequence a user performed. */
function run(state: EditorState, ...actions: Action[]): EditorState {
  return actions.reduce(editorReducer, state);
}

const withRect = () => run(start(), { type: 'addObject', kind: 'rect' });

describe('adding objects', () => {
  it('puts a new shape in front and selects it', () => {
    const state = run(
      start(),
      { type: 'addObject', kind: 'rect' },
      { type: 'addObject', kind: 'ellipse' },
    );
    expect(state.doc.objects.map((o) => o.geometry.kind)).toEqual(['ellipse', 'rect']);
    expect(state.selectedId).toBe(state.doc.objects[0]?.id);
  });

  it('never reuses a name a deleted shape had', () => {
    let state = run(
      start(),
      { type: 'addObject', kind: 'rect' },
      { type: 'addObject', kind: 'rect' },
    );
    const second = state.doc.objects[0]!.id;
    state = run(state, { type: 'deleteObject', id: second }, { type: 'addObject', kind: 'rect' });
    expect(state.doc.objects.map((o) => o.name)).toEqual(['rect 3', 'rect 1']);
  });
});

describe('undo', () => {
  it('restores the document and the selection that went with it', () => {
    const before = start();
    const after = editorReducer(before, { type: 'addObject', kind: 'rect' });
    const undone = editorReducer(after, { type: 'undo' });
    expect(undone.doc).toEqual(before.doc);
    expect(undone.selectedId).toBeNull();
  });

  it('past the start is a no-op rather than an error', () => {
    const state = start();
    expect(editorReducer(state, { type: 'undo' })).toBe(state);
    expect(canUndo(state)).toBe(false);
  });

  it('redo replays what undo took back', () => {
    const state = withRect();
    const round = run(state, { type: 'undo' }, { type: 'redo' });
    expect(round.doc).toEqual(state.doc);
  });

  it('a new edit abandons the redo branch', () => {
    let state = run(withRect(), { type: 'undo' });
    expect(canRedo(state)).toBe(true);
    state = editorReducer(state, { type: 'addObject', kind: 'ellipse' });
    expect(canRedo(state)).toBe(false);
  });

  it('selection is not an edit, so it does not enter the history', () => {
    const state = withRect();
    const selected = editorReducer(state, { type: 'selectObject', id: null });
    expect(selected.past).toBe(state.past);
    expect(editorReducer(selected, { type: 'undo' }).doc).toEqual(emptyDocument('test'));
  });

  it('caps the history rather than growing without bound', () => {
    let state = start();
    for (let i = 0; i < 80; i++) state = editorReducer(state, { type: 'addObject', kind: 'rect' });
    expect(state.past).toHaveLength(50);
  });

  it('labels every entry, because the status slot echoes it', () => {
    const state = withRect();
    expect(state.lastAction?.label).toBe('add rect');
    expect(editorReducer(state, { type: 'undo' }).lastAction?.label).toBe('undid · add rect');
    const redone = run(state, { type: 'undo' }, { type: 'redo' });
    expect(redone.lastAction?.label).toBe('redid · add rect');
  });

  it('names the object it acted on', () => {
    const state = withRect();
    const id = state.doc.objects[0]!.id;
    expect(editorReducer(state, { type: 'moveObject', id, dx: 1, dy: 0 }).lastAction?.label).toBe(
      'move rect 1',
    );
    expect(editorReducer(state, { type: 'toggleHidden', id }).lastAction?.label).toBe('hide rect 1');
    expect(
      editorReducer(run(state, { type: 'toggleHidden', id }), { type: 'toggleHidden', id })
        .lastAction?.label,
    ).toBe('show rect 1');
  });

  it('opening another document clears the history rather than carrying it', () => {
    const replaced = editorReducer(withRect(), {
      type: 'replaceDocument',
      doc: emptyDocument('other'),
    });
    expect(canUndo(replaced)).toBe(false);
    expect(canRedo(replaced)).toBe(false);
  });
});

describe('coalescing', () => {
  const dragged = (gap: number) => {
    const state = withRect();
    const id = state.doc.objects[0]!.id;
    return run(
      state,
      { type: 'moveObject', id, dx: 5, dy: 0, at: 1000 },
      { type: 'moveObject', id, dx: 5, dy: 0, at: 1000 + gap },
    );
  };

  it('folds a continuous drag into one entry, so ⌘Z undoes the gesture', () => {
    const state = dragged(50);
    expect(state.past).toHaveLength(2); // the add, plus one for the whole drag
    const undone = editorReducer(state, { type: 'undo' });
    expect(bounds(undone.doc.objects[0]!).x).toBe(136);
  });

  it('separates two drags with a pause between them', () => {
    expect(dragged(900).past).toHaveLength(3);
  });

  it('does not fold two different objects’ drags together', () => {
    let state = run(start(), { type: 'addObject', kind: 'rect' }, { type: 'addObject', kind: 'ellipse' });
    const [a, b] = state.doc.objects;
    state = run(
      state,
      { type: 'moveObject', id: a!.id, dx: 5, dy: 0, at: 1000 },
      { type: 'moveObject', id: b!.id, dx: 5, dy: 0, at: 1010 },
    );
    expect(state.past).toHaveLength(4);
  });

  it('does not fold a drag into an unrelated edit that happened just before', () => {
    const state = withRect();
    const id = state.doc.objects[0]!.id;
    const after = run(
      state,
      { type: 'toggleLocked', id },
      { type: 'toggleLocked', id },
      { type: 'moveObject', id, dx: 5, dy: 0, at: 1000 },
    );
    expect(after.past).toHaveLength(4);
  });
});

describe('locking', () => {
  it('stops an object moving, resizing or rotating', () => {
    const state = withRect();
    const id = state.doc.objects[0]!.id;
    const locked = editorReducer(state, { type: 'toggleLocked', id });
    const before = locked.doc.objects[0];
    expect(editorReducer(locked, { type: 'moveObject', id, dx: 9, dy: 9 }).doc.objects[0]).toEqual(
      before,
    );
    expect(
      editorReducer(locked, { type: 'rotateObject', id, degrees: 45 }).doc.objects[0],
    ).toEqual(before);
    expect(
      editorReducer(locked, { type: 'resizeObject', id, box: { x: 0, y: 0, w: 9, h: 9 } }).doc
        .objects[0],
    ).toEqual(before);
  });

  it('does not stop it being recoloured or hidden', () => {
    const state = withRect();
    const id = state.doc.objects[0]!.id;
    const locked = editorReducer(state, { type: 'toggleLocked', id });
    const recoloured = editorReducer(locked, {
      type: 'setColor',
      id,
      channel: 'fill',
      ground: 'light',
      hex: '#C0382E',
    });
    expect(recoloured.doc.objects[0]?.fill.light).toBe('#C0382E');
  });
});

describe('colour pairs', () => {
  it('edits only the previewed half, leaving the other alone', () => {
    const state = withRect();
    const id = state.doc.objects[0]!.id;
    const before = state.doc.objects[0]!.fill;
    const after = editorReducer(state, {
      type: 'setColor',
      id,
      channel: 'fill',
      ground: 'dark',
      hex: '#000000',
    });
    expect(after.doc.objects[0]?.fill).toEqual({ light: before.light, dark: '#000000' });
  });

  it('the artboard background works the same way', () => {
    const after = editorReducer(start(), {
      type: 'setBackground',
      ground: 'light',
      hex: '#F7F6F2',
    });
    expect(after.doc.background).toEqual({ light: '#F7F6F2', dark: '#14130F' });
  });
});

describe('states', () => {
  it('will not delete the last one — one state is a legal document', () => {
    const state = start();
    expect(editorReducer(state, { type: 'deleteState', id: state.doc.states[0]!.id })).toBe(state);
  });

  it('deletes down to one', () => {
    let state = run(start(), { type: 'addState' }, { type: 'addState' });
    expect(state.doc.states).toHaveLength(3);
    state = editorReducer(state, { type: 'deleteState', id: state.doc.states[2]!.id });
    state = editorReducer(state, { type: 'deleteState', id: state.doc.states[1]!.id });
    expect(state.doc.states).toHaveLength(1);
  });

  it('gives each added state its own id', () => {
    const state = run(start(), { type: 'addState' }, { type: 'addState' });
    expect(new Set(state.doc.states.map((s) => s.id)).size).toBe(3);
  });

  it('cycles sustain without touching the other states', () => {
    const state = run(start(), { type: 'addState' });
    const after = editorReducer(state, {
      type: 'setSustain',
      id: state.doc.states[1]!.id,
      sustain: 'pulsing',
    });
    expect(after.doc.states.map((s) => s.sustain)).toEqual([null, 'pulsing']);
  });
});

describe('reordering', () => {
  it('moves an object through the stack', () => {
    let state = run(
      start(),
      { type: 'addObject', kind: 'rect' },
      { type: 'addObject', kind: 'ellipse' },
      { type: 'addObject', kind: 'line' },
    );
    state = editorReducer(state, { type: 'reorderObjects', from: 0, to: 2 });
    expect(state.doc.objects.map((o) => o.geometry.kind)).toEqual(['ellipse', 'rect', 'line']);
  });

  it('an out-of-range or no-op move changes nothing at all, including the history', () => {
    const state = withRect();
    expect(editorReducer(state, { type: 'reorderObjects', from: 0, to: 0 })).toBe(state);
    expect(editorReducer(state, { type: 'reorderObjects', from: 0, to: 9 })).toBe(state);
  });
});

describe('clamping', () => {
  it('keeps opacity inside 0–100', () => {
    const state = withRect();
    const id = state.doc.objects[0]!.id;
    expect(editorReducer(state, { type: 'setOpacity', id, opacity: 250 }).doc.objects[0]?.opacity).toBe(100);
    expect(editorReducer(state, { type: 'setOpacity', id, opacity: -8 }).doc.objects[0]?.opacity).toBe(0);
  });

  it('normalises rotation into 0–359, including from negatives', () => {
    const state = withRect();
    const id = state.doc.objects[0]!.id;
    expect(editorReducer(state, { type: 'rotateObject', id, degrees: 400 }).doc.objects[0]?.rotation).toBe(40);
    expect(editorReducer(state, { type: 'rotateObject', id, degrees: -90 }).doc.objects[0]?.rotation).toBe(270);
  });

  it('never lets stroke width go negative', () => {
    const state = withRect();
    const id = state.doc.objects[0]!.id;
    expect(editorReducer(state, { type: 'setStrokeWidth', id, width: -4 }).doc.objects[0]?.strokeWidth).toBe(0);
  });
});

describe('selection', () => {
  it('resolves to the object, and to null once it is deleted', () => {
    const state = withRect();
    const id = state.doc.objects[0]!.id;
    expect(selectedObject(state)?.id).toBe(id);
    const deleted = editorReducer(state, { type: 'deleteObject', id });
    expect(selectedObject(deleted)).toBeNull();
    expect(deleted.selectedId).toBeNull();
  });
});
