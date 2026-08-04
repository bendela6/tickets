import { expect, test } from 'vitest';
import { DEFAULT_DOC } from './doc';
import { INITIAL_STATE, studioReducer } from './state';

test('the initial state is the default document', () => {
  expect(INITIAL_STATE.doc).toEqual(DEFAULT_DOC);
});

test('adding an element appends it with a unique id', () => {
  const next = studioReducer(INITIAL_STATE, { type: 'addElement', elementType: 'ring' });
  const ids = next.doc.elements.map((e) => e.id);

  expect(next.doc.elements).toHaveLength(4);
  expect(next.doc.elements[3]?.type).toBe('ring');
  expect(new Set(ids).size).toBe(ids.length);
});

test('adding two elements of the same type still gives distinct ids', () => {
  const once = studioReducer(INITIAL_STATE, { type: 'addElement', elementType: 'dot' });
  const twice = studioReducer(once, { type: 'addElement', elementType: 'dot' });
  const ids = twice.doc.elements.map((e) => e.id);

  expect(new Set(ids).size).toBe(ids.length);
});

// Regression: `updateElement` only ever applies a patch key already present
// on the target element (`key in e`) — a guard that exists to stop a
// *different* element type's field from attaching, see `ElementPatch`'s
// comment above. `blankElement` must therefore seed every element type with
// a `spin` key, not just `stick` (whose bare mark happens to start spun) —
// omitting it on `ring`/`dot` previously meant a spin toggle on a freshly
// added ring or dot dispatched correctly but was silently dropped by the
// guard, because the key didn't yet exist to overwrite.
test('a newly added ring can have its spin toggled on', () => {
  const added = studioReducer(INITIAL_STATE, { type: 'addElement', elementType: 'ring' });
  const ring = added.doc.elements.at(-1);
  expect(ring?.type).toBe('ring');

  const toggled = studioReducer(added, {
    type: 'updateElement',
    id: ring?.id ?? '',
    patch: { spin: true },
  });
  const result = toggled.doc.elements.find((e) => e.id === ring?.id);
  expect(result?.spin).toBe(true);
});

test('a newly added dot can have its spin toggled on', () => {
  const added = studioReducer(INITIAL_STATE, { type: 'addElement', elementType: 'dot' });
  const dot = added.doc.elements.at(-1);
  expect(dot?.type).toBe('dot');

  const toggled = studioReducer(added, {
    type: 'updateElement',
    id: dot?.id ?? '',
    patch: { spin: true },
  });
  const result = toggled.doc.elements.find((e) => e.id === dot?.id);
  expect(result?.spin).toBe(true);
});

test('removing an element leaves the others in order', () => {
  const next = studioReducer(INITIAL_STATE, { type: 'removeElement', id: 'mid' });
  expect(next.doc.elements.map((e) => e.id)).toEqual(['top', 'low']);
});

// Document order is front-to-back (`elements[0]` is frontmost and leads the
// loader), so moving `top` to index 0 would be a no-op — `low` is the one
// that actually changes the paint order by moving to the front.
test('moving an element changes paint order', () => {
  const next = studioReducer(INITIAL_STATE, { type: 'moveElement', id: 'low', to: 0 });
  expect(next.doc.elements.map((e) => e.id)).toEqual(['low', 'top', 'mid']);
});

test('moveElement clamps an out-of-range index to the nearest valid position', () => {
  // Past the end lands last, not off the end of the array.
  const high = studioReducer(INITIAL_STATE, { type: 'moveElement', id: 'top', to: 999 });
  expect(high.doc.elements.map((e) => e.id)).toEqual(['mid', 'low', 'top']);

  // Before the start lands first, never at a negative index.
  const low = studioReducer(INITIAL_STATE, { type: 'moveElement', id: 'mid', to: -100 });
  expect(low.doc.elements.map((e) => e.id)).toEqual(['mid', 'top', 'low']);
});

test('updating an element drops a patch key the element does not have', () => {
  // `radius` belongs to a ring or a dot, never a stick — but `ElementPatch`
  // cannot reject it appearing alongside `angle` (see its comment), so this
  // typechecks. The reducer must still refuse to attach it.
  const next = studioReducer(INITIAL_STATE, {
    type: 'updateElement',
    id: 'mid',
    patch: { angle: 45, radius: 999 },
  });
  const mid = next.doc.elements.find((e) => e.id === 'mid');

  expect(mid?.type === 'stick' && mid.angle).toBe(45);
  expect(mid && 'radius' in mid).toBe(false);
});

test('updating an element patches only that element', () => {
  const next = studioReducer(INITIAL_STATE, {
    type: 'updateElement',
    id: 'mid',
    patch: { angle: 99 },
  });
  const mid = next.doc.elements.find((e) => e.id === 'mid');
  const top = next.doc.elements.find((e) => e.id === 'top');

  expect(mid?.type === 'stick' && mid.angle).toBe(99);
  expect(top?.type === 'stick' && top.angle).toBe(62);
});

test('setting an ink changes it everywhere it is used', () => {
  const next = studioReducer(INITIAL_STATE, {
    type: 'setInk',
    name: 'top',
    patch: { light: '#123456' },
  });
  expect(next.doc.inks.top).toEqual({ light: '#123456', dark: '#6652ff' });
});

test('setting a variant scale leaves the other variants alone', () => {
  const next = studioReducer(INITIAL_STATE, {
    type: 'setVariant',
    name: 'chip',
    patch: { scale: 0.5 },
  });
  expect(next.doc.variants.chip?.scale).toBe(0.5);
  expect(next.doc.variants.favicon?.scale).toBe(1);
});

test('loadDoc replaces the document wholesale', () => {
  const dirty = studioReducer(INITIAL_STATE, { type: 'removeElement', id: 'mid' });
  const next = studioReducer(dirty, { type: 'loadDoc', doc: DEFAULT_DOC });
  expect(next.doc).toEqual(DEFAULT_DOC);
});
