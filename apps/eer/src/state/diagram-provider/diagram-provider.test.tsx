import { act, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';

import { buildModel } from '../../test/models';
import { useDiagramActions, useDiagramGeometry, useDiagramModelOrNull, useDiagramUi } from '../diagram-context';
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
