import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getModel, listModels, saveModel } from '../../api/models-client';
import { serializeModel } from '../../engine/model/serialize-model';
import type { Model } from '../../engine/model/types';
import { useDiagramModelOrNull, useDiagramUi } from '../../state/diagram-context';
import { DiagramProvider } from '../../state/diagram-provider';
import type { DiagramUi } from '../../state/diagram-reducer';
import { buildModel, twoZoneRaw } from '../../test/models';
import { renderDiagram } from '../../test/render';
import { EditorModals } from '../editor';
import { ModelMenu } from './model-menu';

// ModelMenu's New/Edit-model buttons call useEditor(), which throws without an
// <EditorModals/> ancestor — renderDiagram alone only provides <DiagramProvider/>,
// so tests here layer this small wrapper on top (per the task brief: "if the
// editor context needs its own wrapper, add a small test helper").
function renderWithEditor(ui: ReactNode, raw?: unknown) {
  return renderDiagram(<EditorModals>{ui}</EditorModals>, raw);
}

vi.mock('../../api/models-client');

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

// Surfaces the provider's model/ui slices alongside <ModelMenu/> so tests can
// assert on the load it dispatches without spying on context internals.
let modelRef: Model | null = null;
let uiRef: DiagramUi | null = null;
function Probe() {
  modelRef = useDiagramModelOrNull();
  uiRef = useDiagramUi();
  return null;
}

function secondRaw() {
  return {
    meta: { title: 'Second model' },
    groups: [{ id: 'z', label: 'Z', order: 0 }],
    entities: [{ id: 'only', group: 'z', fields: [{ name: 'id', type: 'int', role: 'pk' }] }],
    relationships: [],
  };
}

// Drains the microtask(s) a mocked models-client promise resolves on so its
// setState lands inside act — same idiom use-model-loader's own tests use.
async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

// A promise plus externally-callable resolve/reject, so a test can control
// exactly when — and in what order — two in-flight getModel() calls settle.
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('ModelMenu', () => {
  beforeEach(() => {
    vi.mocked(listModels).mockResolvedValue([
      { id: 'model-a', title: 'Model A' },
      { id: 'model-b', title: 'Model B' },
    ]);
  });

  it('lists model titles from the API', async () => {
    await renderWithEditor(<ModelMenu />, twoZoneRaw());
    await flush();

    expect(screen.getByRole('option', { name: 'Model A' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Model B' })).toBeInTheDocument();
  });

  it('selecting a model fetches it and loads it into the provider', async () => {
    vi.mocked(getModel).mockResolvedValue(secondRaw());
    await renderWithEditor(
      <>
        <Probe />
        <ModelMenu />
      </>,
      twoZoneRaw(),
    );
    await flush();

    fireEvent.change(screen.getByRole('combobox', { name: 'Model' }), { target: { value: 'model-b' } });
    await flush();

    expect(getModel).toHaveBeenCalledWith('model-b');
    expect(modelRef?.meta.title).toBe('Second model');
    expect(uiRef?.modelId).toBe('model-b');
  });

  it('applies the latest selection, not a stale one that resolves after it', async () => {
    // Model A is picked first but its fetch resolves LAST; Model B is picked
    // second but its fetch resolves FIRST — the out-of-order response a slow
    // network / server can produce for rapid A→B reselection.
    const modelA = deferred<unknown>();
    const modelB = deferred<unknown>();
    vi.mocked(getModel).mockImplementation((id: string) => {
      if (id === 'model-a') return modelA.promise;
      if (id === 'model-b') return modelB.promise;
      throw new Error(`unexpected id: ${id}`);
    });
    const { actions } = await renderWithEditor(
      <>
        <Probe />
        <ModelMenu />
      </>,
      twoZoneRaw(),
    );
    await flush();
    const load = vi.spyOn(actions, 'load');

    const select = screen.getByRole('combobox', { name: 'Model' });
    fireEvent.change(select, { target: { value: 'model-a' } });
    fireEvent.change(select, { target: { value: 'model-b' } });
    expect(getModel).toHaveBeenNthCalledWith(1, 'model-a');
    expect(getModel).toHaveBeenNthCalledWith(2, 'model-b');

    // Resolve out of order: the newer (model-b) request settles first...
    modelB.resolve(secondRaw());
    await flush();
    // ...then the older (model-a) request finally settles, with different data.
    modelA.resolve({ ...secondRaw(), meta: { title: 'First model (stale)' } });
    await flush();

    // The stale model-a response must be ignored: exactly one load, for model-b.
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenLastCalledWith(expect.anything(), 'model-b');
    expect(modelRef?.meta.title).toBe('Second model');
    expect(uiRef?.modelId).toBe('model-b');
  });

  it('shows an inline confirm before discarding unsaved changes, and only loads on Discard', async () => {
    vi.mocked(getModel).mockResolvedValue(secondRaw());
    const { actions } = await renderWithEditor(
      <>
        <Probe />
        <ModelMenu />
      </>,
      twoZoneRaw(),
    );
    await flush();
    await act(async () => actions.load(buildModel(twoZoneRaw()), 'model-a'));
    await act(async () => actions.setColors(new Map([['z1', '#123456']])));
    expect(uiRef?.dirty).toBe(true);

    // First change: dirty guard intercepts — an inline bar, not window.confirm.
    fireEvent.change(screen.getByRole('combobox', { name: 'Model' }), { target: { value: 'model-b' } });
    expect(screen.getByText('Discard unsaved changes?')).toBeInTheDocument();
    expect(getModel).not.toHaveBeenCalled();
    expect(uiRef?.modelId).toBe('model-a');

    // Cancel: bar closes, nothing loads, still dirty on the old model.
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Discard unsaved changes?')).not.toBeInTheDocument();
    expect(getModel).not.toHaveBeenCalled();
    expect(uiRef?.modelId).toBe('model-a');

    // Re-select + Discard: only now does the fetch/load actually happen.
    fireEvent.change(screen.getByRole('combobox', { name: 'Model' }), { target: { value: 'model-b' } });
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    await flush();

    expect(getModel).toHaveBeenCalledWith('model-b');
    expect(uiRef?.modelId).toBe('model-b');
    expect(uiRef?.dirty).toBe(false);
  });

  it('Save serializes the current model and marks it saved once the API confirms', async () => {
    vi.mocked(saveModel).mockResolvedValue(true);
    const { actions } = await renderWithEditor(
      <>
        <Probe />
        <ModelMenu />
      </>,
      twoZoneRaw(),
    );
    await flush();
    await act(async () => actions.load(buildModel(twoZoneRaw()), 'model-a'));
    await act(async () => actions.setColors(new Map([['z1', '#123456']])));
    expect(uiRef?.dirty).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await flush();

    expect(saveModel).toHaveBeenCalledWith('model-a', serializeModel(modelRef!, uiRef!.colors));
    expect(uiRef?.dirty).toBe(false); // markSaved() ran after the resolved save
  });

  it('disables Save and never calls saveModel when no model id is loaded (e.g. the bundled default)', async () => {
    // renderDiagram's initial load() omits the modelId arg, exactly like loading
    // the bundled default model — ui.modelId stays null (see diagram-reducer LOAD).
    await renderWithEditor(
      <>
        <Probe />
        <ModelMenu />
      </>,
      twoZoneRaw(),
    );
    await flush();
    expect(uiRef?.modelId).toBeNull();

    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();

    fireEvent.click(save);
    expect(saveModel).not.toHaveBeenCalled();
  });

  it('hides the whole menu when listModels() resolves null', async () => {
    vi.mocked(listModels).mockResolvedValue(null);
    render(
      <DiagramProvider>
        <EditorModals>
          <ModelMenu />
        </EditorModals>
      </DiagramProvider>,
    );
    await flush();

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New' })).not.toBeInTheDocument();
  });
});
