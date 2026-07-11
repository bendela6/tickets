import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { buildModel, twoZoneRaw } from '../../test/models';
import { EerDiagram, type DiagramOptions } from './eer-diagram';

beforeAll(() => {
  globalThis.requestAnimationFrame ??= ((cb: FrameRequestCallback) =>
    setTimeout(() => cb(0), 0) as unknown as number) as typeof requestAnimationFrame;
});

let viewport: HTMLDivElement;
let diagram: EerDiagram;

function setup(opts: DiagramOptions = {}): EerDiagram {
  viewport = document.createElement('div');
  viewport.className = 'viewport';
  const mount = document.createElement('div');
  viewport.appendChild(mount);
  document.body.appendChild(viewport);
  diagram = new EerDiagram(viewport, mount, opts);
  diagram.load(buildModel(twoZoneRaw()));
  return diagram;
}

afterEach(() => {
  diagram.destroy();
  viewport.remove();
});

describe('EerDiagram', () => {
  it('load builds the scene: cards and edges appear inside the mount', () => {
    const d = setup();
    expect(viewport.querySelector('.world')).not.toBeNull();
    expect(viewport.querySelectorAll('.card')).toHaveLength(3);
    expect(viewport.querySelectorAll('g.edge')).toHaveLength(3);
    expect(viewport.querySelector('.card[data-entity="users"]')).not.toBeNull();
    expect(d.model.meta.title).toBe('Fixture');
  });

  it('selectEntity and clearSelection notify onSelect', () => {
    const onSelect = vi.fn();
    const d = setup({ onSelect });
    d.selectEntity('users');
    expect(onSelect).toHaveBeenLastCalledWith({ type: 'entity', id: 'users' });
    d.clearSelection();
    expect(onSelect).toHaveBeenLastCalledWith({ type: 'none' });
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it('search returns entity and field matches', () => {
    const d = setup();
    const results = d.search('user');
    expect(results.length).toBeGreaterThan(0);
    expect(results).toContainEqual(expect.objectContaining({ kind: 'entity', entityId: 'users' }));
    expect(results).toContainEqual(expect.objectContaining({ kind: 'field', field: 'users_id', entityId: 'orders' }));
    expect(d.search('   ')).toEqual([]);
    expect(d.search('zzz-no-such-thing')).toEqual([]);
  });

  it('search caps at 20 results even when far more match', () => {
    const d = setup();
    d.load(
      buildModel({
        groups: [{ id: 'g', label: 'G' }],
        entities: Array.from({ length: 25 }, (_, i) => ({
          id: `user${i}`,
          group: 'g',
          fields: [{ name: 'id', type: 'int', role: 'pk' }],
        })),
        relationships: [],
      }),
    );
    // 25 entity entries + 25 field entries match "user" — the cap must bite.
    expect(d.search('user')).toHaveLength(20);
  });

  it('destroy removes the world element from the mount', () => {
    setup();
    expect(viewport.querySelector('.world')).not.toBeNull();
    diagram.destroy();
    expect(viewport.querySelector('.world')).toBeNull();
  });
});
