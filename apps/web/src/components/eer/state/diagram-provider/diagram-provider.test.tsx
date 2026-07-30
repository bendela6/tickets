import { act, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';

import { Diagram } from '../../view/diagram/diagram';
import { fitView } from '../../engine/layout/fit-view';
import { visibleBounds } from '../../engine/layout/visible-bounds';
import { renderDiagram } from '../../test/render';
import { buildModel } from '../../test/models';
import {
  useDiagramActions,
  useDiagramDispatch,
  useDiagramGeometry,
  useDiagramModelOrNull,
  useDiagramUi,
  useDiagramView,
} from '../diagram-context';
import { DiagramProvider } from './diagram-provider';

if (!('requestAnimationFrame' in globalThis)) {
  (globalThis as { requestAnimationFrame?: (cb: FrameRequestCallback) => number }).requestAnimationFrame = (cb) =>
    setTimeout(() => cb(0), 0) as unknown as number;
}

function Probe() {
  const model = useDiagramModelOrNull();
  const ui = useDiagramUi();
  const geometry = useDiagramGeometry();
  const actions = useDiagramActions();
  return (
    <div>
      <span data-testid="n">{model ? model.entities.length : 0}</span>
      <span data-testid="focus">{ui.focus?.id ?? 'none'}</span>
      <span data-testid="routes">{geometry.routes.size}</span>
      <button onClick={() => actions.load(buildModel())}>load</button>
      <button onClick={() => actions.selectEntity('users')}>sel</button>
      <button onClick={() => actions.setRouting('curved')}>curved</button>
    </div>
  );
}

it('provider loads a model, exposes slices, derives geometry', async () => {
  render(
    <DiagramProvider>
      <Probe />
    </DiagramProvider>,
  );
  expect(screen.getByTestId('n').textContent).toBe('0');
  await act(async () => screen.getByText('load').click());
  expect(screen.getByTestId('n').textContent).toBe('3');
  expect(Number(screen.getByTestId('routes').textContent)).toBeGreaterThan(0); // twoZoneRaw routing=avoid
  await act(async () => screen.getByText('curved').click());
  expect(screen.getByTestId('routes').textContent).toBe('0');
  await act(async () => screen.getByText('sel').click());
  expect(screen.getByTestId('focus').textContent).toBe('users');
});

it('search + isolateSilent behave like the legacy engine', async () => {
  let captured: ReturnType<typeof useDiagramActions> | null = null;
  let ui: ReturnType<typeof useDiagramUi> | null = null;
  function Grab() {
    captured = useDiagramActions();
    ui = useDiagramUi();
    return null;
  }
  render(
    <DiagramProvider>
      <Grab />
    </DiagramProvider>,
  );
  await act(async () => captured!.load(buildModel()));
  expect(captured!.search('users').length).toBeGreaterThan(0);
  await act(async () => captured!.selectEntity('users'));
  await act(async () => captured!.isolateSilent('u-o'));
  expect(ui!.focus).toEqual({ type: 'edge', id: 'u-o' });
  expect(ui!.panelSelection).toEqual({ type: 'entity', id: 'users' });
});

// Regression for the stale-stateRef bug: rearrange()/repackAndFit() used to call
// fit() synchronously right after dispatch, so fit() read stateRef.current from
// BEFORE the repack (React hasn't re-rendered yet). After dragging a card far
// away, that framed the dragged (pre-repack) bounds instead of the freshly
// packed diagram. <Diagram/>'s [data-viewport] binds viewportRef so fit() actually
// dispatches SET_VIEW; jsdom's clientWidth/clientHeight are 0, which is fine —
// pan still depends on the model's bounds, so a wrong (stale) model still
// produces a detectably wrong pan.
it('rearrange() fits the freshly repacked model, not the stale pre-repack one', async () => {
  let dispatch: ReturnType<typeof useDiagramDispatch> | null = null;
  let latestModel: ReturnType<typeof useDiagramModelOrNull> = null;
  let latestView: ReturnType<typeof useDiagramView> | null = null;
  function Probe2() {
    dispatch = useDiagramDispatch();
    latestModel = useDiagramModelOrNull();
    latestView = useDiagramView();
    return null;
  }

  const { actions } = await renderDiagram(
    <Diagram>
      <Probe2 />
    </Diagram>,
  );
  // load()'s own double-rAF fit settles before we start dragging.
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });

  // Drag 'users' far away — SET_POSITIONS lands immediately; REARRANGE hasn't
  // repacked yet, so the model momentarily has an entity out at (5000, 5000).
  await act(async () => {
    dispatch!({ type: 'SET_POSITIONS', entities: [{ id: 'users', x: 5000, y: 5000 }], boxes: [] });
  });

  await act(async () => {
    actions.rearrange();
    // Real timers: this single real-time wait drains however many chained
    // setTimeout(0)s the rAF polyfill needs — sync pre-fix, double-rAF post-fix.
    await new Promise((r) => setTimeout(r, 20));
  });

  const model = latestModel;
  if (!model) throw new Error('expected a loaded model after rearrange()');
  // packLayout ignores input x/y (deterministic by declaration order), so the
  // post-rearrange model is back to a compact layout — nothing like the dragged
  // (5000, 5000) bounds the pre-fix synchronous fit() would have framed.
  const expected = fitView(visibleBounds(model, new Set()), 0, 0);
  expect(latestView).toMatchObject(expected);
});
