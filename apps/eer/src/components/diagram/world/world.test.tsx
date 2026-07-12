import { act } from '@testing-library/react';
import { expect, it } from 'vitest';

import { useDiagramDispatch } from '../../../state/diagram-context';
import { renderDiagram } from '../../../test/render';
import { World } from './world';

// Grabs dispatch directly so the test can drive SET_VIEW without a bound
// viewport ref — see the deviation note on the second assertion below.
let dispatchRef: ReturnType<typeof useDiagramDispatch> | null = null;
function DispatchGrab() {
  dispatchRef = useDiagramDispatch();
  return null;
}

it('applies the view transform and updates on SET_VIEW', async () => {
  const { container, actions } = await renderDiagram(
    <>
      <DispatchGrab />
      <World>
        <span />
      </World>
    </>,
  );
  const world = container.querySelector('[data-world]') as HTMLElement;
  expect(world.style.getPropertyValue('--world-pan-x')).toMatch(/px$/);
  expect(world.style.getPropertyValue('--world-zoom')).toBe('1');
  await act(async () => actions.setRouting('curved')); // unrelated slice → transform unchanged
  const before = world.style.getPropertyValue('--world-pan-x');
  // jsdom gives the viewport a 0×0 rect, and actions.centerOn bails out early
  // when no <div ref={viewportRef}> is mounted (none is, in this render) — so it
  // is a no-op here. Dispatch SET_VIEW directly to prove the transform tracks
  // view state, keeping the original assertion's intent.
  await act(async () => dispatchRef!({ type: 'SET_VIEW', view: { panX: 50 } }));
  expect(world.style.getPropertyValue('--world-pan-x')).not.toBe(before);
});
