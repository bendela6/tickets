import { expect, it } from 'vitest';

import { buildModel } from '../../test/models';
import { diagramReducer, initialDiagramState, type DiagramState } from './diagram-reducer';

function loaded(): DiagramState {
  // buildModel returns a packed model; LOAD re-packs a copy — fine for tests
  return diagramReducer(initialDiagramState, { type: 'LOAD', model: buildModel() });
}

it('LOAD packs the model and resets view/ui', () => {
  const s = loaded();
  expect(s.model!._groupBounds.length).toBeGreaterThan(0);
  expect(s.view).toEqual({ zoom: 1, panX: 0, panY: 0, routing: 'avoid' }); // twoZoneRaw view.routing
  expect(s.ui.focus).toBeNull();
});

it('SET_POSITIONS shares structure: untouched entities keep identity', () => {
  const s = loaded();
  const before = s.model!;
  const s2 = diagramReducer(s, { type: 'SET_POSITIONS', entities: [{ id: 'users', x: 10, y: 20 }], boxes: [] });
  const users = s2.model!.entityById.get('users')!;
  expect(users.x).toBe(10);
  expect(users).not.toBe(before.entityById.get('users'));
  expect(s2.model!.entityById.get('tags')).toBe(before.entityById.get('tags'));
  expect(before.entityById.get('users')!.x).not.toBe(10); // old state untouched
});

it('SET_POSITIONS moves group boxes too', () => {
  const s = loaded();
  const b0 = s.model!._groupBounds[0]!;
  const s2 = diagramReducer(s, { type: 'SET_POSITIONS', entities: [], boxes: [{ id: b0.id, x: b0.x + 5, y: b0.y + 6 }] });
  expect(s2.model!._groupBounds[0]!.x).toBe(b0.x + 5);
  expect(s2.model!._groupBounds[1]).toBe(s.model!._groupBounds[1]);
});

it('RESIZE_GROUP rewrites one box', () => {
  const s = loaded();
  const id = s.model!._groupBounds[0]!.id;
  const s2 = diagramReducer(s, { type: 'RESIZE_GROUP', id, x: 1, y: 2, w: 300, h: 200 });
  expect(s2.model!._groupBounds.find((b) => b.id === id)).toMatchObject({ x: 1, y: 2, w: 300, h: 200 });
});

it('selection actions mirror the legacy engine', () => {
  let s = loaded();
  s = diagramReducer(s, { type: 'SELECT_ENTITY', id: 'users' });
  expect(s.ui.focus).toEqual({ type: 'entity', id: 'users' });
  expect(s.ui.panelSelection).toEqual({ type: 'entity', id: 'users' });
  s = diagramReducer(s, { type: 'ISOLATE_EDGE', id: 'u-o', silent: true });
  expect(s.ui.focus).toEqual({ type: 'edge', id: 'u-o' });
  expect(s.ui.panelSelection).toEqual({ type: 'entity', id: 'users' }); // silent keeps the panel
  expect(s.ui.raisedEdge).toBe('u-o');
  s = diagramReducer(s, { type: 'CLEAR_SELECTION' });
  expect(s.ui.focus).toBeNull();
  expect(s.ui.panelSelection).toEqual({ type: 'none' });
  expect(s.ui.raisedEdge).toBeNull();
});

it('REARRANGE clears focus, REPACK keeps it', () => {
  let s = loaded();
  s = diagramReducer(s, { type: 'SELECT_ENTITY', id: 'users' });
  const kept = diagramReducer(s, { type: 'REPACK' });
  expect(kept.ui.focus).toEqual({ type: 'entity', id: 'users' });
  const cleared = diagramReducer(s, { type: 'REARRANGE' });
  expect(cleared.ui.focus).toBeNull();
});

it('REARRANGE clears a saved layout so the button still moves cards', () => {
  let s = loaded();
  s = { ...s, model: { ...s.model!, _savedLayout: { entities: new Map([['users', { x: 1, y: 2 }]]), groups: new Map() } } };
  const rearranged = diagramReducer(s, { type: 'REARRANGE' });
  expect(rearranged.model!._savedLayout).toBeUndefined();
  expect(rearranged.model!.entityById.get('users')!.x).not.toBe(1);
});

it('TOGGLE_GROUP / TOGGLE_KIND flip set membership immutably', () => {
  let s = loaded();
  s = diagramReducer(s, { type: 'TOGGLE_GROUP', id: 'z1' });
  expect(s.ui.hidden.groups.has('z1')).toBe(true);
  s = diagramReducer(s, { type: 'TOGGLE_GROUP', id: 'z1' });
  expect(s.ui.hidden.groups.has('z1')).toBe(false);
});

it('FOCUS_FROM_SEARCH sets focus + field highlight', () => {
  const s = diagramReducer(loaded(), { type: 'FOCUS_FROM_SEARCH', entityId: 'users', field: 'id' });
  expect(s.ui.focus).toEqual({ type: 'entity', id: 'users' });
  expect(s.ui.fieldHighlight).toEqual({ entityId: 'users', field: 'id' });
});
