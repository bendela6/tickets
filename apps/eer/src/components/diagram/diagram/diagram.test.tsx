import { act, cleanup, render } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';

import { DiagramProvider } from '../../../state/diagram-provider';
import { renderDiagram } from '../../../test/render';
import { Diagram } from './diagram';

afterEach(cleanup);

// The .viewport binds the gesture listeners on first commit, so it must mount
// before any model is loaded — only the World subtree is gated on the model.
it('mounts the .viewport unconditionally, before any model loads', () => {
  const { container } = render(
    <DiagramProvider>
      <Diagram />
    </DiagramProvider>,
  );
  expect(container.querySelector('.viewport')).not.toBeNull();
  expect(container.querySelector('.world')).toBeNull();
});

it('composes the full scene from the loaded fixture and hosts overlay children', async () => {
  const { container } = await renderDiagram(
    <Diagram>
      <div data-testid="overlay" />
    </Diagram>,
  );
  // load() schedules a double-rAF fit that dispatches against the now-bound
  // viewport ref — drain it so the SET_VIEW lands inside act.
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
  });

  const viewport = container.querySelector('.viewport')!;
  expect(viewport.querySelectorAll('.world .card')).toHaveLength(3);
  expect(viewport.querySelectorAll('svg.edges g.edge')).toHaveLength(3);
  expect(viewport.querySelectorAll('.world .zone')).toHaveLength(2);

  const overlay = container.querySelector('[data-testid="overlay"]')!;
  expect(viewport.contains(overlay)).toBe(true);
});
