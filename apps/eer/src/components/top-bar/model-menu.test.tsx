import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getModel, listModels, saveModel } from '../../api/models-client';
import { serializeModel } from '../../engine/model/serialize-model';
import type { Model } from '../../engine/model/types';
import { useDiagramModelOrNull, useDiagramUi } from '../../state/diagram-context';
import { DiagramProvider } from '../../state/diagram-provider';
import type { DiagramUi } from '../../state/diagram-reducer';
import { buildModel, twoZoneRaw } from '../../test/models';
import { renderDiagram } from '../../test/render';
import { ModelMenu } from './model-menu';

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

describe('ModelMenu', () => {
  beforeEach(() => {
    vi.mocked(listModels).mockResolvedValue([
      { id: 'model-a', title: 'Model A' },
      { id: 'model-b', title: 'Model B' },
    ]);
  });

  it('lists model titles from the API', async () => {
    await renderDiagram(<ModelMenu />, twoZoneRaw());
    await flush();

    expect(screen.getByRole('option', { name: 'Model A' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Model B' })).toBeInTheDocument();
  });

  it('selecting a model fetches it and loads it into the provider', async () => {
    vi.mocked(getModel).mockResolvedValue(secondRaw());
    await renderDiagram(
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

  it('shows an inline confirm before discarding unsaved changes, and only loads on Discard', async () => {
    vi.mocked(getModel).mockResolvedValue(secondRaw());
    const { actions } = await renderDiagram(
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
    const { actions } = await renderDiagram(
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

  it('hides the whole menu when listModels() resolves null', async () => {
    vi.mocked(listModels).mockResolvedValue(null);
    render(
      <DiagramProvider>
        <ModelMenu />
      </DiagramProvider>,
    );
    await flush();

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New' })).not.toBeInTheDocument();
  });
});
