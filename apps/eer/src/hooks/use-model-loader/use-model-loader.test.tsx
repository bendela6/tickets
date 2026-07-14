import { StrictMode } from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { useDiagramModelOrNull, useDiagramUi } from '../../state/diagram-context';
import { DiagramProvider } from '../../state/diagram-provider';
import { useModelLoader } from './use-model-loader';

// render.tsx's polyfill isn't imported here; the loader's actions.load schedules
// a double-rAF fit that maps onto setTimeout(0) once rAF exists.
beforeAll(() => {
  globalThis.requestAnimationFrame ??= ((cb: FrameRequestCallback) =>
    setTimeout(() => cb(0), 0) as unknown as number) as typeof requestAnimationFrame;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  // Reset the URL so a `?model=` set by one test never leaks into the next.
  window.history.pushState({}, '', '/');
});

// One host exercises the loader and surfaces both the diagnostics and the
// provider's model so a single render covers all assertions.
function Host() {
  const { diagnostics } = useModelLoader();
  const model = useDiagramModelOrNull();
  const ui = useDiagramUi();
  return (
    <div>
      <span data-testid="n">{model?.entities.length ?? 0}</span>
      <span data-testid="modelId">{ui.modelId ?? ''}</span>
      <span data-testid="errs">{diagnostics.errors.join('|')}</span>
      <span data-testid="warns">{diagnostics.warnings.join('|')}</span>
    </div>
  );
}

function renderHost() {
  return render(
    <DiagramProvider>
      <Host />
    </DiagramProvider>,
  );
}

function renderHostStrict() {
  return render(
    <StrictMode>
      <DiagramProvider>
        <Host />
      </DiagramProvider>
    </StrictMode>,
  );
}

// Drain the loader's double-rAF fit + any fonts.ready microtask so its state
// updates land inside act and never leak a "not wrapped in act" warning.
async function flush() {
  await act(async () => {
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe('useModelLoader', () => {
  it('loads the bundled default model when the models API has nothing to offer', async () => {
    // No ?model=/?id= — the hook tries listModels() first; a 404 here stands
    // in for "no API at all" (a production build), same as models-client's
    // own null-on-404 contract.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    renderHost();
    await waitFor(() => expect(Number(screen.getByTestId('n').textContent)).toBeGreaterThan(0));
    expect(screen.getByTestId('modelId').textContent).toBe('');
    expect(screen.getByTestId('errs').textContent).toBe('');
    await flush();
  });

  it('loads a model via ?id= through the models API, passing the id to actions.load', async () => {
    const raw = {
      groups: [{ id: 'z', label: 'Z' }],
      entities: [{ id: 'a', group: 'z', fields: [{ name: 'id', type: 'int', role: 'pk' }] }],
      relationships: [],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(raw) }));
    window.history.pushState({}, '', '/?id=some-slug');

    renderHost();
    await waitFor(() => expect(screen.getByTestId('modelId').textContent).toBe('some-slug'));
    expect(Number(screen.getByTestId('n').textContent)).toBeGreaterThan(0);
    expect(screen.getByTestId('errs').textContent).toBe('');
    await flush();
  });

  it('loads the first model listModels() returns when no ?model=/?id= is given', async () => {
    const raw = {
      groups: [{ id: 'z', label: 'Z' }],
      entities: [{ id: 'a', group: 'z', fields: [{ name: 'id', type: 'int', role: 'pk' }] }],
      relationships: [],
    };
    const fetchMock = vi.fn((url: string) => {
      if (url === '/api/models')
        return Promise.resolve({ ok: true, json: () => Promise.resolve([{ id: 'first', title: 'First' }]) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve(raw) });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderHost();
    await waitFor(() => expect(screen.getByTestId('modelId').textContent).toBe('first'));
    expect(Number(screen.getByTestId('n').textContent)).toBeGreaterThan(0);
    expect(screen.getByTestId('errs').textContent).toBe('');
    await flush();
  });

  it('surfaces validator warnings from a fetched ?model=', async () => {
    // A subgroup pointing at a missing parent → one warning, no errors.
    const raw = {
      groups: [
        { id: 'z', label: 'Z' },
        { id: 's', label: 'S', parent: 'nope' },
      ],
      entities: [{ id: 'a', group: 'z', fields: [{ name: 'id', type: 'int', role: 'pk' }] }],
      relationships: [],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(raw) }));
    window.history.pushState({}, '', '/?model=/warn.json');

    renderHost();
    await waitFor(() => expect(screen.getByTestId('warns').textContent).toContain('unknown parent'));
    expect(Number(screen.getByTestId('n').textContent)).toBeGreaterThan(0);
    await flush();
  });

  it('loads a fetched ?model= under StrictMode double-invoke', async () => {
    // Regression: a `ran` ref guard would let mount 1 start the fetch, have
    // its cleanup flip that closure's `cancelled` true, then mount 2 bail
    // out on `ran.current` without re-fetching — model never loads.
    const raw = {
      groups: [{ id: 'z', label: 'Z' }],
      entities: [{ id: 'a', group: 'z', fields: [{ name: 'id', type: 'int', role: 'pk' }] }],
      relationships: [],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(raw) }));
    window.history.pushState({}, '', '/?model=/strict.json');

    renderHostStrict();
    await waitFor(() => expect(Number(screen.getByTestId('n').textContent)).toBeGreaterThan(0));
    expect(screen.getByTestId('errs').textContent).toBe('');
    await flush();
  });

  it('reports a fetch error as an error diagnostic', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    window.history.pushState({}, '', '/?model=/missing.json');

    renderHost();
    await waitFor(() => expect(screen.getByTestId('errs').textContent).toContain('Could not load /missing.json'));
    expect(screen.getByTestId('errs').textContent).toContain('HTTP 404');
    expect(Number(screen.getByTestId('n').textContent)).toBe(0);
  });
});
