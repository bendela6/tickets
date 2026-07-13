import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { deleteModel, getModel, listModels } from '../../api/models-client';
import { useDiagramUi } from '../../state/diagram-context';
import type { DiagramUi } from '../../state/diagram-reducer';
import { buildModel, twoZoneRaw } from '../../test/models';
import { renderDiagram } from '../../test/render';
import { ModelModal } from './model-modal';

vi.mock('../../api/models-client');

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

// Surfaces ui.modelId alongside <ModelModal/> so tests can assert the
// resurrection-blocking clear without spying on context internals.
let uiRef: DiagramUi | null = null;
function Probe() {
  uiRef = useDiagramUi();
  return null;
}

// Drains the microtask chain a Delete click's async handleDelete() runs
// through (deleteModel → listModels → [getModel → loadModel]) so its setState
// calls land inside act, same idiom model-menu.test.tsx's flush() uses.
async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('ModelModal delete', () => {
  it('deleting the only remaining model clears ui.modelId — Save can no longer resurrect it', async () => {
    vi.mocked(deleteModel).mockResolvedValue(true);
    vi.mocked(listModels).mockResolvedValue([]); // nothing left after delete

    const onClose = vi.fn();
    const { actions } = await renderDiagram(
      <>
        <Probe />
        <ModelModal onClose={onClose} />
      </>,
      twoZoneRaw(),
    );
    await act(async () => actions.load(buildModel(twoZoneRaw()), 'model-a'));
    expect(uiRef?.modelId).toBe('model-a');

    fireEvent.click(screen.getByRole('button', { name: 'Delete model' }));
    await flush();

    expect(deleteModel).toHaveBeenCalledWith('model-a');
    expect(uiRef?.modelId).toBeNull();
    expect(screen.getByText(/No other models remain/)).toBeInTheDocument();
  });

  it('delete succeeds but the fallback model fails to load — modal stays open, id is cleared, no auto-close', async () => {
    vi.mocked(deleteModel).mockResolvedValue(true);
    vi.mocked(listModels).mockResolvedValue([{ id: 'model-b', title: 'B' }]);
    vi.mocked(getModel).mockResolvedValue({}); // invalid raw — loadModel will report errors

    const onClose = vi.fn();
    const { actions } = await renderDiagram(
      <>
        <Probe />
        <ModelModal onClose={onClose} />
      </>,
      twoZoneRaw(),
    );
    await act(async () => actions.load(buildModel(twoZoneRaw()), 'model-a'));
    expect(uiRef?.modelId).toBe('model-a');

    fireEvent.click(screen.getByRole('button', { name: 'Delete model' }));
    await flush();

    expect(deleteModel).toHaveBeenCalledWith('model-a');
    expect(getModel).toHaveBeenCalledWith('model-b');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(uiRef?.modelId).toBeNull();
    expect(screen.getByText(/failed to load/)).toBeInTheDocument();
  });
});
