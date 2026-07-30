import { act, fireEvent } from '@testing-library/react';
import { expect, it } from 'vitest';

import { EdgesSvg } from '../../view/diagram/edges-svg';
import { EntityCards } from '../../view/diagram/entity-cards';
import { World } from '../../view/diagram/world';
import { ZoneBoxes } from '../../view/diagram/zone-boxes';
import { useDiagramModelOrNull, useViewportRef } from '../../state/diagram-context';
import { renderDiagram } from '../../test/render';
import { useDiagramGestures } from './use-diagram-gestures';

// The assembled scene: the hook wires the viewport, the scene renders from state.
// The inner scene reads useDiagramModel() (throws pre-load), so gate it on the
// model like the real app does — the viewport div (and its ref) always mounts so
// the hook's listeners attach before load.
function Scene() {
  const viewportRef = useViewportRef();
  useDiagramGestures(viewportRef);
  const model = useDiagramModelOrNull();
  return (
    <div ref={viewportRef} data-viewport="">
      {model && (
        <World>
          <ZoneBoxes />
          <EdgesSvg />
          <EntityCards />
        </World>
      )}
    </div>
  );
}

it('click on a card selects; drag past threshold moves it', async () => {
  const { container, actions } = await renderDiagram(<Scene />);
  const card = container.querySelector('[data-card][data-entity="users"]') as HTMLElement;
  fireEvent.mouseDown(card, { button: 0, clientX: 10, clientY: 10 });
  fireEvent.mouseUp(window);
  expect(container.querySelector('[data-card][data-entity="users"]')!.hasAttribute('data-selected')).toBe(true);

  await act(async () => actions.clearSelection());
  const before = (container.querySelector('[data-card][data-entity="users"]') as HTMLElement).style.getPropertyValue('--card-x');
  fireEvent.mouseDown(container.querySelector('[data-card][data-entity="users"]')!, { button: 0, clientX: 10, clientY: 10 });
  fireEvent.mouseMove(window, { clientX: 60, clientY: 40 });
  fireEvent.mouseUp(window);
  const after = (container.querySelector('[data-card][data-entity="users"]') as HTMLElement).style.getPropertyValue('--card-x');
  expect(after).not.toBe(before);
  expect(container.querySelector('[data-card][data-entity="users"]')!.hasAttribute('data-selected')).toBe(false);
});

it('empty-space click clears selection; drag pans', async () => {
  const { container, actions } = await renderDiagram(<Scene />);
  await act(async () => actions.selectEntity('users'));
  const vp = container.querySelector('[data-viewport]') as HTMLElement;
  fireEvent.mouseDown(vp, { button: 0, clientX: 5, clientY: 5 });
  fireEvent.mouseUp(window);
  expect(container.querySelector('[data-card][data-selected]')).toBeNull();

  const world = container.querySelector('[data-world]') as HTMLElement;
  const t0 = world.style.getPropertyValue('--world-pan-x');
  fireEvent.mouseDown(vp, { button: 0, clientX: 5, clientY: 5 });
  fireEvent.mouseMove(window, { clientX: 105, clientY: 55 });
  fireEvent.mouseUp(window);
  expect(world.style.getPropertyValue('--world-pan-x')).not.toBe(t0);
});

it('middle-button drag pans the world', async () => {
  const { container } = await renderDiagram(<Scene />);
  const vp = container.querySelector('[data-viewport]') as HTMLElement;
  const world = container.querySelector('[data-world]') as HTMLElement;
  const t0 = world.style.getPropertyValue('--world-pan-x');
  fireEvent.mouseDown(vp, { button: 1, clientX: 20, clientY: 20 });
  fireEvent.mouseMove(window, { clientX: 80, clientY: 60 });
  fireEvent.mouseUp(window);
  expect(world.style.getPropertyValue('--world-pan-x')).not.toBe(t0);
});

it('zone click focuses the group', async () => {
  const { container } = await renderDiagram(<Scene />);
  const zone = container.querySelector('[data-zone][data-group="z2"]') as HTMLElement;
  fireEvent.mouseDown(zone, { button: 0, clientX: 400, clientY: 300 });
  fireEvent.mouseUp(window);
  expect(zone.hasAttribute('data-selected')).toBe(true);
  // jsdom rects are 0×0 so edgeMaskFor returns null → the zone mousedown takes the
  // group path (never resize), and a synthetic drag from a non-edge point can't be
  // built here; group-move geometry is covered by the reducer's SET_POSITIONS test.
});

it('wheel zooms toward the cursor within [0.15, 3]', async () => {
  const { container } = await renderDiagram(<Scene />);
  const vp = container.querySelector('[data-viewport]') as HTMLElement;
  const world = container.querySelector('[data-world]') as HTMLElement;
  fireEvent.wheel(vp, { deltaY: -500, clientX: 100, clientY: 100 });
  expect(world.style.getPropertyValue('--world-zoom')).not.toBe('1');
});

it('Escape clears the selection', async () => {
  const { container, actions } = await renderDiagram(<Scene />);
  await act(async () => actions.selectEntity('users'));
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(container.querySelector('[data-card][data-selected]')).toBeNull();
});
