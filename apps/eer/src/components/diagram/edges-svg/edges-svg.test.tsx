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
  const svg = container.querySelector('svg[data-edges]') as SVGSVGElement;
  expect(svg.getAttribute('width')).not.toBeNull();
  const gs = svg.querySelectorAll('g[data-rel]');
  expect(gs.length).toBe(3);
  const g = svg.querySelector('g[data-rel="rel:orders:c2"]') as SVGGElement;
  expect(g.dataset.kind).toBe('fk');
  expect(g.style.getPropertyValue('--edge-c')).toBeTruthy();
  expect(g.querySelectorAll('path').length).toBe(4); // hit, casing, visible path, arrow head
  expect(g.querySelector('path[data-path]')).toBeTruthy();
  expect((g.querySelector('[data-path]') as SVGPathElement).getAttribute('d')).toMatch(/^M/);
});
it('dashed kinds get .dashed on the visible path', async () => {
  const raw = twoZoneRaw();
  raw.relationships[1]!.kind = 'nm'; // t-o becomes many-to-many (dashed style)
  // A derived fk edge always wins over an authored duplicate for the same pair
  // (see derive-relationships.ts), and a derived edge is always kind:'fk' —
  // so strip tag_id's own fk-ness here, leaving the authored 'nm' rel as the
  // only edge for this pair, to actually exercise dashed-kind rendering.
  const tagField = raw.entities[1]!.fields[2] as unknown as { role: string | null; ref: string | null };
  tagField.role = null;
  tagField.ref = null;
  const { container } = await renderDiagram(
    <Loaded>
      <EdgesSvg />
    </Loaded>,
    raw,
  );
  expect(container.querySelector('g[data-rel="t-o"] [data-path]')!.hasAttribute('data-dashed')).toBe(true);
});
it('isolate: endpoints lit, others dim, svg lifts, raised edge renders last', async () => {
  const { container, actions } = await renderDiagram(
    <Loaded>
      <EdgesSvg />
    </Loaded>,
  );
  await act(async () => actions.isolate('rel:orders:c2'));
  const svg = container.querySelector('svg[data-edges]')!;
  expect(svg.hasAttribute('data-top')).toBe(true);
  expect(svg.querySelector('g[data-rel="rel:orders:c2"]')!.hasAttribute('data-active')).toBe(true);
  expect(svg.querySelector('g[data-rel="rel:orders:c3"]')!.hasAttribute('data-dim')).toBe(true);
  const order = [...svg.querySelectorAll('g[data-rel]')].map((g) => (g as SVGGElement).dataset.rel);
  expect(order[order.length - 1]).toBe('rel:orders:c2');
});
it('edge hover marks hot and raises; click isolates', async () => {
  const { container, actions } = await renderDiagram(
    <Loaded>
      <EdgesSvg />
    </Loaded>,
  );
  const g = container.querySelector('g[data-rel="rel:orders:c3"]') as SVGGElement;
  fireEvent.mouseEnter(g);
  expect(g.hasAttribute('data-hot')).toBe(true);
  fireEvent.mouseLeave(g);
  expect(g.hasAttribute('data-hot')).toBe(false);
  fireEvent.click(g);
  // focus visible through DOM: svg lifted + this edge active
  expect(container.querySelector('svg[data-edges]')!.hasAttribute('data-top')).toBe(true);
  expect(g.hasAttribute('data-active')).toBe(true);
  void actions;
});
it('field highlight heats attached edges; hidden kind hides the edge', async () => {
  const { container, actions } = await renderDiagram(
    <Loaded>
      <EdgesSvg />
    </Loaded>,
  );
  await act(async () => actions.focusFromSearch('users', 'id'));
  expect(container.querySelector('g[data-rel="rel:orders:c2"]')!.hasAttribute('data-hot')).toBe(true);
  await act(async () => actions.clearSelection());
  await act(async () => actions.toggleKind('fk'));
  expect(container.querySelector('g[data-rel="rel:orders:c2"]')!.classList.contains('hidden')).toBe(true);
});
