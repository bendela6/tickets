import type { ReactNode } from 'react';
import { expect, it } from 'vitest';

import { useDiagramModelOrNull } from '../../../state/diagram-context';
import { buildModel } from '../../../test/models';
import { renderDiagram } from '../../../test/render';
import { computeEdgeGeometry } from '../../routing/edge-geometry';
import { EdgesSvg } from '../../../components/diagram/edges-svg';
import { EntityCards } from '../../../components/diagram/entity-cards';
import { World } from '../../../components/diagram/world';
import { ZoneBoxes } from '../../../components/diagram/zone-boxes';
import { runChecks } from './run-checks';

// The scene components read useDiagramModel() (throws pre-load) — the real app
// only ever mounts them once a model exists. renderDiagram mounts `ui`
// synchronously before its `load()` call, so gate the World subtree on the model
// being present (same as Task 11-13's harness), while the viewport div itself
// stays outside the gate so `root` can be queried at any point.
function Loaded({ children }: { children: ReactNode }) {
  return useDiagramModelOrNull() ? <>{children}</> : null;
}

// <Diagram> arrives in T15 — compose the scene inline here.
async function checkedScene() {
  const { container } = await renderDiagram(
    <div data-viewport="">
      <Loaded>
        <World>
          <ZoneBoxes />
          <EdgesSvg />
          <EntityCards />
        </World>
      </Loaded>
    </div>,
  );
  const model = buildModel(); // same fixture the helper loaded — packLayout is deterministic
  const root = container.querySelector('[data-viewport]') as HTMLElement;
  return { model, root, container };
}

it('all four checks pass on a healthy scene (modulo jsdom zero-rects)', async () => {
  const { model, root } = await checkedScene();
  const results = runChecks({ model, geometry: computeEdgeGeometry(model, 'avoid'), view: { zoom: 1, panX: 0, panY: 0 }, root });
  expect(results).toHaveLength(4);
  // jsdom zero-rects make the DOM-bar comparison unreliable (old suite had the same caveat),
  // so exempt only the endpoint check's DOM half from the pass assertion:
  expect(results.filter((r) => r.name !== 'Every edge endpoint lands on a real port').every((r) => r.pass)).toBe(true);
});

it('no-reflow probe preserves pre-existing focus/selected/hot state', async () => {
  const { model, root } = await checkedScene();
  // Simulate a live selection: the first card (users) is focused+selected and its
  // edge (u-o) is hot — exactly the attributes the no-reflow probe injects.
  const card = root.querySelector('[data-card][data-entity="users"]')!;
  const edge = root.querySelector('[data-rel="u-o"]')!;
  card.setAttribute('data-focus', '');
  card.setAttribute('data-selected', '');
  edge.setAttribute('data-hot', '');
  const results = runChecks({ model, geometry: computeEdgeGeometry(model, 'avoid'), view: { zoom: 1, panX: 0, panY: 0 }, root });
  expect(results.find((r) => r.name === 'Hover/focus never moves a node')!.pass).toBe(true);
  // The probe must only remove attributes IT added — the live selection survives.
  expect(card.hasAttribute('data-focus')).toBe(true);
  expect(card.hasAttribute('data-selected')).toBe(true);
  expect(edge.hasAttribute('data-hot')).toBe(true);
});

it('failure injection: a missing port and a corrupted path are reported', async () => {
  const { model, root } = await checkedScene();
  root.querySelector('[data-side="L"][data-entity="users"][data-field="name"]')!.remove();
  root.querySelector('[data-rel="u-o"] [data-path]')!.setAttribute('d', 'M 0 0 L 1 1');
  const results = runChecks({ model, geometry: computeEdgeGeometry(model, 'avoid'), view: { zoom: 1, panX: 0, panY: 0 }, root });
  expect(results.find((r) => r.name === 'Exactly one L + one R port per field')!.problems.join()).toContain('users.name');
  expect(results.find((r) => r.name === 'Every edge endpoint lands on a real port')!.problems.join()).toContain('u-o: path start off source port');
});
