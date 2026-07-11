import { afterEach, describe, expect, it } from 'vitest';

import { cleanupScene, makeScene } from '../../../test/scene';
import { runChecks } from './run-checks';
import type { EngineState } from '../../model/types';

let state: EngineState;
afterEach(() => cleanupScene(state));

// NOTE: jsdom's getBoundingClientRect returns zeros, so the endpoint check's
// DOM-bar comparison may legitimately report problems here. We assert the shape
// and the two checks that are DOM-metric independent.

describe('runChecks', () => {
  it('returns exactly the four named checks, in order, with a coherent shape', () => {
    state = makeScene();
    const results = runChecks(state);
    expect(results.map((r) => r.name)).toEqual([
      'Every edge endpoint lands on a real port',
      'Exactly one L + one R port per field',
      'Hover/focus never moves a node',
      'Broken references surface as errors',
    ]);
    for (const r of results) {
      expect(typeof r.pass).toBe('boolean');
      expect(typeof r.scope).toBe('string');
      expect(r.scope.length).toBeGreaterThan(0);
      expect(Array.isArray(r.problems)).toBe(true);
      expect(r.pass).toBe(r.problems.length === 0);
    }
  });

  it('the port-pairs and broken-refs checks pass in jsdom', () => {
    state = makeScene();
    const results = runChecks(state);
    expect(results[1]).toMatchObject({ pass: true, problems: [] });
    expect(results[1]!.scope).toBe('7 fields'); // 3 + 3 + 1 fixture fields
    expect(results[3]).toMatchObject({ pass: true, problems: [] });
  });

  // The checks must be able to FAIL — inject defects and assert they're caught.

  it('reports a removed port element as a port-pairs failure naming the field', () => {
    state = makeScene();
    state.els.cards.get('users')!.querySelector('.port.left[data-field="name"]')!.remove();
    const results = runChecks(state);
    expect(results[1]!.pass).toBe(false);
    expect(results[1]!.problems.some((p) => p.includes('users.name'))).toBe(true);
  });

  it('reports a path that leaves its source port as an endpoint failure', () => {
    state = makeScene();
    state.els.edgeEls.get('u-o')!.path.setAttribute('d', 'M 0 0 L 1 1');
    const results = runChecks(state);
    expect(results[0]!.pass).toBe(false);
    expect(results[0]!.problems).toContain('u-o: path start off source port');
  });

  it('does not throw and leaves entity coordinates unchanged', () => {
    state = makeScene();
    const before = state.model.entities.map((e) => ({ id: e.id, x: e.x, y: e.y }));
    expect(() => runChecks(state)).not.toThrow();
    expect(state.model.entities.map((e) => ({ id: e.id, x: e.x, y: e.y }))).toEqual(before);
    expect(state.focus).toBeNull(); // the reflow probe restores a clean focus state
  });
});
