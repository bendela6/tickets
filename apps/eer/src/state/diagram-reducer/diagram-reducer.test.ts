import { expect, it } from 'vitest';

import { buildModel, nestedRaw, twoZoneRaw } from '../../test/models';
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
  expect(s.ui.dirty).toBe(false);
  expect(s.ui.modelId).toBeNull();
});

it('LOAD seeds colors from the model, stores the model id, and clears dirty', () => {
  const raw = { ...twoZoneRaw(), colors: { z1: '#ff0000' } };
  const s = diagramReducer(initialDiagramState, { type: 'LOAD', model: buildModel(raw), modelId: 'model-1' });
  expect(s.ui.colors.get('z1')).toBe('#ff0000');
  expect(s.ui.modelId).toBe('model-1');
  expect(s.ui.dirty).toBe(false);
});

it('LOAD without a modelId resets a stale ui.modelId — Save must not overwrite the wrong file', () => {
  const withId = diagramReducer(initialDiagramState, { type: 'LOAD', model: buildModel(), modelId: 'alpha' });
  expect(withId.ui.modelId).toBe('alpha');

  // A subsequent LOAD with no modelId (e.g. "New model") must clear it, not
  // inherit 'alpha' from the previous state — otherwise Save silently targets
  // the old file.
  const withoutId = diagramReducer(withId, { type: 'LOAD', model: buildModel(nestedRaw()) });
  expect(withoutId.ui.modelId).toBeNull();
});

it('CLEAR_MODEL_ID nulls ui.modelId only — model, dirty, and selection are untouched', () => {
  let s = diagramReducer(initialDiagramState, { type: 'LOAD', model: buildModel(), modelId: 'alpha' });
  s = diagramReducer(s, { type: 'SELECT_ENTITY', id: 'users' });
  s = diagramReducer(s, { type: 'SET_POSITIONS', entities: [{ id: 'users', x: 10, y: 20 }], boxes: [] });
  expect(s.ui.modelId).toBe('alpha');
  expect(s.ui.dirty).toBe(true);

  const cleared = diagramReducer(s, { type: 'CLEAR_MODEL_ID' });
  expect(cleared.ui.modelId).toBeNull();
  expect(cleared.model).toBe(s.model); // same reference — diagram left alone
  expect(cleared.ui.dirty).toBe(true);
  expect(cleared.ui.focus).toEqual({ type: 'entity', id: 'users' });
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

// Reviewer-found: REARRANGE moves every card but left ui.dirty untouched, so
// switching models right after a rearrange silently discarded the new layout
// with no unsaved-changes confirm — the same layout change SET_POSITIONS and
// RESIZE_GROUP already mark dirty for.
it('REARRANGE sets dirty — a rearranged layout is an unsaved change like any other', () => {
  const s = loaded();
  expect(s.ui.dirty).toBe(false);
  const rearranged = diagramReducer(s, { type: 'REARRANGE' });
  expect(rearranged.ui.dirty).toBe(true);
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

it('APPLY_MODEL_EDIT rewrites the model immutably and sets dirty', () => {
  const s = loaded();
  const s2 = diagramReducer(s, {
    type: 'APPLY_MODEL_EDIT',
    edit: { kind: 'setMeta', title: 'New title', description: 'New description' },
  });
  expect(s2.model!.meta.title).toBe('New title');
  expect(s2.ui.dirty).toBe(true);
  expect(s.model!.meta.title).not.toBe('New title'); // old state untouched
  expect(s.ui.dirty).toBe(false);
});

it('SET_COLORS, SET_POSITIONS, and RESIZE_GROUP set dirty; MARK_SAVED clears it', () => {
  let s = loaded();
  expect(s.ui.dirty).toBe(false);

  s = diagramReducer(s, { type: 'SET_COLORS', colors: new Map([['z1', '#00ff00']]) });
  expect(s.ui.dirty).toBe(true);
  s = diagramReducer(s, { type: 'MARK_SAVED' });
  expect(s.ui.dirty).toBe(false);

  s = diagramReducer(s, { type: 'SET_POSITIONS', entities: [{ id: 'users', x: 10, y: 20 }], boxes: [] });
  expect(s.ui.dirty).toBe(true);
  s = diagramReducer(s, { type: 'MARK_SAVED' });
  expect(s.ui.dirty).toBe(false);

  const boxId = s.model!._groupBounds[0]!.id;
  s = diagramReducer(s, { type: 'RESIZE_GROUP', id: boxId, x: 1, y: 2, w: 300, h: 200 });
  expect(s.ui.dirty).toBe(true);
  s = diagramReducer(s, { type: 'MARK_SAVED' });
  expect(s.ui.dirty).toBe(false);
});

it('an invalid APPLY_MODEL_EDIT leaves model and dirty untouched and sets editError', () => {
  const s = loaded();
  const s2 = diagramReducer(s, { type: 'APPLY_MODEL_EDIT', edit: { kind: 'deleteGroup', id: 'ghost' } });
  expect(s2.model).toBe(s.model); // unchanged (same reference) — reducer must not throw
  expect(s2.ui.editError).toMatch(/ghost/);
  expect(s2.ui.dirty).toBe(false);
});

it('a failed APPLY_MODEL_EDIT preserves an existing dirty:true instead of resetting it', () => {
  // Start from a state that is already dirty from a real edit, so the next
  // assertion can tell "left alone" apart from "happens to be false".
  const dirty = diagramReducer(loaded(), {
    type: 'APPLY_MODEL_EDIT',
    edit: { kind: 'setMeta', title: 'New title', description: 'New description' },
  });
  expect(dirty.ui.dirty).toBe(true);

  const s2 = diagramReducer(dirty, {
    type: 'APPLY_MODEL_EDIT',
    edit: { kind: 'upsertEntity', entity: { id: 'x', label: 'x', group: 'no-such-group', description: null, fields: [], constraints: [], indexes: [] } },
  });
  expect(s2.model).toBe(dirty.model); // unchanged reference — reducer must not throw
  expect(s2.ui.dirty).toBe(true); // preserved, not reset to false
  expect(s2.ui.editError).toMatch(/no-such-group/);
});

it('a failed edit error is cleared by the next successful edit, by LOAD, or by CLEAR_EDIT_ERROR', () => {
  const failed = diagramReducer(loaded(), { type: 'APPLY_MODEL_EDIT', edit: { kind: 'deleteGroup', id: 'ghost' } });
  expect(failed.ui.editError).not.toBeNull();

  const afterSuccess = diagramReducer(failed, {
    type: 'APPLY_MODEL_EDIT',
    edit: { kind: 'setMeta', title: 'T', description: 'D' },
  });
  expect(afterSuccess.ui.editError).toBeNull();

  const afterLoad = diagramReducer(failed, { type: 'LOAD', model: buildModel() });
  expect(afterLoad.ui.editError).toBeNull();

  const afterClear = diagramReducer(failed, { type: 'CLEAR_EDIT_ERROR' });
  expect(afterClear.ui.editError).toBeNull();
  expect(afterClear.model).toBe(failed.model);
});
