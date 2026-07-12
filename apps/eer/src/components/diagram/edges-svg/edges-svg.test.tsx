import { act, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import { expect, it } from 'vitest';

import { useDiagramModelOrNull } from '../../../state/diagram-context';
import { twoZoneRaw } from '../../../test/models';
import { renderDiagram } from '../../../test/render';
import { EdgesSvg } from './edges-svg';

// EdgesSvg reads useDiagramModel() (throws pre-load) — the real app only ever
// mounts it once a model exists. renderDiagram mounts `ui` synchronously before
// its `load()` call, so gate the mount on the model being present, same as the
// eventual assembled scene will.
function Loaded({ children }: { children: ReactNode }) {
  return useDiagramModelOrNull() ? <>{children}</> : null;
}

it('renders parity edge DOM with paths attached to ports', async () => {
  const { container } = await renderDiagram(
    <Loaded>
      <EdgesSvg />
    </Loaded>,
  );
  const svg = container.querySelector('svg.edges') as SVGSVGElement;
  expect(svg.style.width).not.toBe('');
  const gs = svg.querySelectorAll('g.edge');
  expect(gs.length).toBe(3);
  const g = svg.querySelector('g.edge[data-rel="u-o"]') as SVGGElement;
  expect(g.dataset.kind).toBe('fk');
  expect(g.style.getPropertyValue('--edge-c')).toBeTruthy();
  for (const cls of ['edge-hit', 'edge-casing', 'edge-path', 'edge-head']) {
    expect(g.querySelector('path.' + cls.split(' ').join('.'))).toBeTruthy();
  }
  expect((g.querySelector('.edge-path') as SVGPathElement).getAttribute('d')).toMatch(/^M/);
});
it('dashed kinds get .dashed on the visible path', async () => {
  const raw = twoZoneRaw();
  raw.relationships[1]!.kind = 'nm'; // t-o becomes many-to-many (dashed style)
  const { container } = await renderDiagram(
    <Loaded>
      <EdgesSvg />
    </Loaded>,
    raw,
  );
  expect(container.querySelector('g.edge[data-rel="t-o"] .edge-path')!.classList.contains('dashed')).toBe(true);
});
it('isolate: endpoints lit, others dim, svg lifts, raised edge renders last', async () => {
  const { container, actions } = await renderDiagram(
    <Loaded>
      <EdgesSvg />
    </Loaded>,
  );
  await act(async () => actions.isolate('u-o'));
  const svg = container.querySelector('svg.edges')!;
  expect(svg.classList.contains('edge-top')).toBe(true);
  expect(svg.querySelector('g.edge[data-rel="u-o"]')!.classList.contains('active')).toBe(true);
  expect(svg.querySelector('g.edge[data-rel="t-o"]')!.classList.contains('dim')).toBe(true);
  const order = [...svg.querySelectorAll('g.edge')].map((g) => (g as SVGGElement).dataset.rel);
  expect(order[order.length - 1]).toBe('u-o');
});
it('edge hover marks hot and raises; click isolates', async () => {
  const { container, actions } = await renderDiagram(
    <Loaded>
      <EdgesSvg />
    </Loaded>,
  );
  const g = container.querySelector('g.edge[data-rel="t-o"]') as SVGGElement;
  fireEvent.mouseEnter(g);
  expect(g.classList.contains('hot')).toBe(true);
  fireEvent.mouseLeave(g);
  expect(g.classList.contains('hot')).toBe(false);
  fireEvent.click(g);
  // focus visible through DOM: svg lifted + this edge active
  expect(container.querySelector('svg.edges')!.classList.contains('edge-top')).toBe(true);
  expect(g.classList.contains('active')).toBe(true);
  void actions;
});
it('field highlight heats attached edges; hidden kind hides the edge', async () => {
  const { container, actions } = await renderDiagram(
    <Loaded>
      <EdgesSvg />
    </Loaded>,
  );
  await act(async () => actions.focusFromSearch('users', 'id'));
  expect(container.querySelector('g.edge[data-rel="u-o"]')!.classList.contains('hot')).toBe(true);
  await act(async () => actions.clearSelection());
  await act(async () => actions.toggleKind('fk'));
  expect(container.querySelector('g.edge[data-rel="u-o"]')!.classList.contains('hidden')).toBe(true);
});
