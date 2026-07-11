import { afterEach, describe, expect, it } from 'vitest';

import { twoZoneRaw } from '../../test/models';
import { cleanupScene, makeScene } from '../../test/scene';
import { edgeEndpoints } from '../edge-endpoints';
import { drawEdge } from './draw-edge';
import type { EngineState } from '../types';

let state: EngineState;
afterEach(() => cleanupScene(state));

describe('drawEdge', () => {
  it('writes the same non-empty d to path, casing and hit', () => {
    state = makeScene();
    const rel = state.model.relById.get('u-o')!;
    const els = state.els.edgeEls.get('u-o')!;
    for (const el of [els.path, els.casing, els.hit]) el.setAttribute('d', '');
    drawEdge(state, rel, false);
    const d = els.path.getAttribute('d')!;
    expect(d).not.toBe('');
    expect(els.casing.getAttribute('d')).toBe(d);
    expect(els.hit.getAttribute('d')).toBe(d);
  });

  it('draws a crow’s-foot head only at the many end of a 1-n edge', () => {
    state = makeScene();
    for (const id of ['u-o', 't-o'] as const) {
      const rel = state.model.relById.get(id)!;
      expect(rel.cardinality, id).toBe('1-n');
      drawEdge(state, rel, false);
      const head = state.els.edgeEls.get(id)!.head.getAttribute('d')!;
      expect(head, id).not.toBe('');
      expect(head.match(/M/g)!.length, id + ' has one 3-prong foot').toBe(3); // one foot, not two
      const { p2 } = edgeEndpoints(state.model, rel);
      expect(head.startsWith(`M${p2.x} ${p2.y}`), id + ' foot sits at the target (many) port').toBe(true);
    }
  });

  it('leaves the head empty on a self-loop but still draws its path', () => {
    state = makeScene();
    const rel = state.model.relById.get('self')!;
    drawEdge(state, rel, false);
    const els = state.els.edgeEls.get('self')!;
    expect(els.head.getAttribute('d')).toBe('');
    expect(els.path.getAttribute('d')).not.toBe('');
  });

  it('leaves the head empty on a 1-1 edge (two one ends, no feet)', () => {
    const raw = twoZoneRaw();
    (raw.relationships[0] as { cardinality?: string }).cardinality = '1-1'; // u-o
    state = makeScene(raw);
    const rel = state.model.relById.get('u-o')!;
    expect(rel.cardinality).toBe('1-1');
    drawEdge(state, rel, false);
    expect(state.els.edgeEls.get('u-o')!.head.getAttribute('d')).toBe('');
  });
});
