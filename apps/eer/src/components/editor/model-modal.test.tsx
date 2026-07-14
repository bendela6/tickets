import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { deleteModel, getModel, listModels } from '../../api/models-client';
import type { Model } from '../../engine/model/types';
import { useDiagramModelOrNull, useDiagramUi } from '../../state/diagram-context';
import type { DiagramUi } from '../../state/diagram-reducer';
import { buildModel, twoZoneRaw } from '../../test/models';
import { renderDiagram } from '../../test/render';
import { ModelModal } from './model-modal';
import { TypePicker } from './type-picker';

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

// Surfaces the live model alongside <ModelModal/> for the enum-manager tests
// below — enum edits dispatch straight through the reducer (see
// enums-editor.tsx's own header comment), so asserting the post-dispatch
// model is the only way to see a rename's cascade or a refused delete's
// no-op land.
let modelRef: Model | null = null;
function ModelProbe() {
  modelRef = useDiagramModelOrNull();
  return null;
}

// Same fixture shape as apply-model-edit.test.ts's rawWithEnum (Task 3) and
// enums-editor.test.tsx: one enum ('user_kind') used by two columns on
// `users` — a plain column and an array column.
function rawWithEnum() {
  return {
    groups: [{ id: 'g', label: 'G' }],
    enums: [{ name: 'user_kind', values: ['human', 'agent'], schema: null }],
    entities: [
      {
        id: 'users',
        label: 'Users',
        group: 'g',
        columns: [
          { name: 'id', type: 'integer' },
          { name: 'kind', type: 'user_kind' },
          { name: 'kinds', type: 'user_kind[]' },
        ],
        constraints: [{ id: 'c1', kind: 'pk', columns: ['id'] }],
      },
    ],
  };
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

describe('ModelModal enum manager', () => {
  it('renaming an enum re-points every column that uses it, cascading to array columns too', async () => {
    await renderDiagram(
      <>
        <ModelProbe />
        <ModelModal onClose={() => {}} />
      </>,
      rawWithEnum(),
    );

    const name = screen.getByLabelText('Enum 1 name');
    fireEvent.change(name, { target: { value: 'actor_kind' } });
    fireEvent.blur(name);

    expect(modelRef!.enums.map((e) => e.name)).toEqual(['actor_kind']);
    expect(modelRef!.entityById.get('users')!.columns.find((c) => c.name === 'kind')!.type).toBe('actor_kind');
    expect(modelRef!.entityById.get('users')!.columns.find((c) => c.name === 'kinds')!.type).toBe('actor_kind[]');
  });

  it('refuses to delete an enum in use and names the dependents; the enum survives', async () => {
    await renderDiagram(
      <>
        <ModelProbe />
        <ModelModal onClose={() => {}} />
      </>,
      rawWithEnum(),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete enum user_kind' }));

    expect(screen.getByText(/users\.kind/)).toBeInTheDocument();
    expect(modelRef!.enums.map((e) => e.name)).toContain('user_kind'); // still there
  });

  it('a newly added enum is immediately pickable as a column type', async () => {
    await renderDiagram(
      <>
        <ModelProbe />
        <ModelModal onClose={() => {}} />
      </>,
      rawWithEnum(),
    );

    fireEvent.click(screen.getByRole('button', { name: '+ add enum' }));
    const name = screen.getByLabelText('Enum 2 name');
    fireEvent.change(name, { target: { value: 'order_status' } });
    fireEvent.blur(name);

    expect(modelRef!.enums.map((e) => e.name)).toContain('order_status');

    // The type picker (Task 11) surfaces model.enums verbatim in its own
    // violet section — feeding it the just-updated model proves the new
    // enum is immediately selectable as a column type, end to end.
    cleanup();
    render(<TypePicker value="text" enums={modelRef!.enums} onPick={() => {}} onClose={() => {}} />);
    expect(screen.getByRole('option', { name: 'order_status' })).toBeInTheDocument();
  });

  it('reordering an enum’s values is not sorted — DDL order survives in the live model', async () => {
    await renderDiagram(
      <>
        <ModelProbe />
        <ModelModal onClose={() => {}} />
      </>,
      rawWithEnum(),
    );

    fireEvent.click(screen.getByLabelText('Move enum 1 value 2 up'));

    expect(modelRef!.enums.find((e) => e.name === 'user_kind')!.values).toEqual(['agent', 'human']);
  });
});
