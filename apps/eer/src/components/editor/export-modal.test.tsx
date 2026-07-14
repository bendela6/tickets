// Export-to-drizzle modal: previews exportDrizzle(model)'s generated source and
// POSTs it to the (mocked) /api/drizzle/export route. Write file is disabled —
// with the reason shown — whenever exportDrizzle throws (unknown column type or
// an unreproducible construct); the disabled state is derived by actually
// calling exportDrizzle and catching, never by re-deciding exportability a
// second time.

import { act, cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderDiagram } from '../../test/render';
import { ExportModal } from './export-modal';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function validRaw() {
  return {
    meta: { title: 'Base' },
    groups: [{ id: 'g', label: 'G', order: 0 }],
    entities: [
      {
        id: 'users',
        group: 'g',
        fields: [
          { name: 'id', type: 'integer', role: 'pk' },
          { name: 'email', type: 'text' },
        ],
      },
    ],
    relationships: [],
  };
}

// legacy_money is the codebase's own canonical example of an unknown column
// type (see pg-types.test.ts) — parseType reports it as `known: false`.
function rawWithUnknownType() {
  return {
    meta: { title: 'Base' },
    groups: [{ id: 'g', label: 'G', order: 0 }],
    entities: [
      {
        id: 'accounts',
        group: 'g',
        fields: [
          { name: 'id', type: 'integer', role: 'pk' },
          { name: 'balance', type: 'legacy_money' },
        ],
      },
    ],
    relationships: [],
  };
}

describe('ExportModal', () => {
  it('blocks export when a column type is unknown, and says why', async () => {
    await renderDiagram(<ExportModal onClose={() => {}} />, rawWithUnknownType());

    expect(screen.getByRole('button', { name: /write file/i })).toBeDisabled();
    expect(screen.getByText(/legacy_money/)).toBeInTheDocument();
  });

  it('renders a preview of the generated source for an exportable model', async () => {
    await renderDiagram(<ExportModal onClose={() => {}} />, validRaw());

    expect(screen.getByRole('button', { name: /write file/i })).not.toBeDisabled();
    expect(screen.getByText(/pgTable/)).toBeInTheDocument();
    expect(screen.getByText(/export const users/)).toBeInTheDocument();
  });

  it('Write file POSTs the filename + generated source to the export route', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ path: 'apps/eer/exports/schema.generated.ts' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await renderDiagram(<ExportModal onClose={() => {}} />, validRaw());
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /write file/i }));
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/drizzle/export',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('export const users'),
      }),
    );
    expect(await screen.findByText(/schema\.generated\.ts/)).toBeInTheDocument();
  });

  it('surfaces the export route error message without crashing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Bad export filename.' }),
      }),
    );

    await renderDiagram(<ExportModal onClose={() => {}} />, validRaw());
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /write file/i }));
    });

    expect(await screen.findByText(/Bad export filename\./)).toBeInTheDocument();
  });
});
