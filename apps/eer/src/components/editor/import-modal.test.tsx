// Import-from-drizzle modal: always a dry run. Re-scan fetches a schema
// description off the (mocked) /api/drizzle/schema route and runs importDrizzle
// against the CURRENT model — nothing touches the diagram until Apply import is
// clicked. Fetch is mocked (vi.stubGlobal('fetch', ...)) rather than standing up
// a real dev server, same idiom use-model-loader.test.tsx already uses.

import { act, cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { SchemaDescription } from '../../node/describe-drizzle';
import { useDiagramModelOrNull, useDiagramUi } from '../../state/diagram-context';
import type { DiagramUi } from '../../state/diagram-reducer';
import type { Model } from '../../engine/model/types';
import { renderDiagram } from '../../test/render';
import { ImportModal } from './import-modal';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

let modelRef: Model | null = null;
let uiRef: DiagramUi | null = null;
function Probe() {
  modelRef = useDiagramModelOrNull();
  uiRef = useDiagramUi();
  return null;
}

function baseRaw() {
  return {
    meta: { title: 'Base' },
    groups: [{ id: 'g', label: 'G', order: 0 }],
    entities: Array.from({ length: 22 }, (_, i) => ({
      id: `t${i + 1}`,
      group: 'g',
      fields: [{ name: 'id', type: 'integer', role: 'pk' }],
    })),
    relationships: [],
  };
}

// A small, three-table base used only by the tests that assert on the
// report's exact rows — baseRaw()'s 22 tables would make "removed" span 20
// rows and turn getByText(/leaves the canvas/i) ambiguous.
function smallRaw() {
  return {
    meta: { title: 'Small' },
    groups: [{ id: 'g', label: 'G', order: 0 }],
    entities: [
      { id: 't1', group: 'g', fields: [{ name: 'id', type: 'integer', role: 'pk' }] },
      { id: 't2', group: 'g', fields: [{ name: 'id', type: 'integer', role: 'pk' }] },
      { id: 't3', group: 'g', fields: [{ name: 'id', type: 'integer', role: 'pk' }] },
    ],
    relationships: [],
  };
}

function tableDesc(name: string, extraColumns: SchemaDescription['tables'][number]['columns'] = []): SchemaDescription['tables'][number] {
  return {
    schema: null,
    name,
    columns: [
      { name: 'id', sqlType: 'integer', notNull: true, default: null, identity: null, generated: null },
      ...extraColumns,
    ],
    primaryKey: { name: null, columns: ['id'] },
    uniques: [],
    checks: [],
    foreignKeys: [],
    indexes: [],
  };
}

// 18 of the original 22 tables (t1..t18) — t19..t22 are dropped, matching the
// task brief's illustrative "22 -> 18" scan.
const SCAN_18: SchemaDescription = {
  tables: Array.from({ length: 18 }, (_, i) => tableDesc(`t${i + 1}`)),
  enums: [],
  groups: [{ key: 'g', label: 'G', color: '#123456', tables: Array.from({ length: 18 }, (_, i) => `t${i + 1}`) }],
  unsupported: [],
};

// A smaller, hand-composed scan that exercises all three report buckets at
// once: t1 unchanged, t2 gains a column (changed), a brand-new "comments"
// table (added), t3 is gone (removed).
const SCAN_MIXED: SchemaDescription = {
  tables: [
    tableDesc('t1'),
    tableDesc('t2', [{ name: 'body', sqlType: 'text', notNull: false, default: null, identity: null, generated: null }]),
    tableDesc('comments'),
  ],
  enums: [],
  groups: [{ key: 'g', label: 'G', color: '#123456', tables: ['t1', 't2', 'comments'] }],
  unsupported: [],
};

const SCAN_WITH_UNSUPPORTED: SchemaDescription = {
  tables: [tableDesc('t1')],
  enums: [],
  groups: [{ key: 'g', label: 'G', color: '#123456', tables: ['t1'] }],
  unsupported: [
    {
      kind: 'relations',
      where: 'ticketRelations',
      detail: 'relations() is TypeScript-only sugar with no SQL representation; it cannot be reproduced on export',
      blocksExport: true,
    },
  ],
};

function stubFetchJson(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    }),
  );
}

async function scan() {
  await act(async () => {
    await userEvent.click(screen.getByRole('button', { name: /re-scan/i }));
  });
}

describe('ImportModal', () => {
  it('applies nothing until Apply is pressed', async () => {
    stubFetchJson(200, SCAN_18);
    await renderDiagram(
      <>
        <Probe />
        <ImportModal onClose={() => {}} />
      </>,
      baseRaw(),
    );

    await scan();
    expect(modelRef!.entities).toHaveLength(22); // unchanged — the seed

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /apply import/i }));
    });
    expect(modelRef!.entities).toHaveLength(18);
  });

  it('preserves the currently-loaded model id on Apply, so Save keeps targeting the right file', async () => {
    stubFetchJson(200, SCAN_18);
    const { actions } = await renderDiagram(
      <>
        <Probe />
        <ImportModal onClose={() => {}} />
      </>,
      baseRaw(),
    );
    await act(async () => actions.load(modelRef!, 'model-a'));
    expect(uiRef?.modelId).toBe('model-a');

    await scan();
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /apply import/i }));
    });

    expect(uiRef?.modelId).toBe('model-a');
  });

  it('shows the report grouped by + added / ~ changed / − removed, with canvas-effect copy', async () => {
    stubFetchJson(200, SCAN_MIXED);
    await renderDiagram(<ImportModal onClose={() => {}} />, smallRaw());

    await scan();

    expect(screen.getByText('comments')).toBeInTheDocument();
    expect(screen.getByText(/draws a new card/i)).toBeInTheDocument();
    expect(screen.getByText('t3')).toBeInTheDocument();
    expect(screen.getByText(/leaves the canvas/i)).toBeInTheDocument();
  });

  it('lists unsupported constructs in a distinct section, worded "cannot be reproduced", and flags blocksExport', async () => {
    stubFetchJson(200, SCAN_WITH_UNSUPPORTED);
    await renderDiagram(<ImportModal onClose={() => {}} />, baseRaw());

    await scan();

    expect(screen.getByText(/ticketRelations/)).toBeInTheDocument();
    expect(screen.getByText(/cannot be reproduced — resolve before exporting/i)).toBeInTheDocument();
    expect(screen.queryByText(/kept verbatim/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/re-emitted unchanged/i)).not.toBeInTheDocument();
    expect(screen.getByText(/export is blocked/i)).toBeInTheDocument();
  });

  it('shows the route error message and never crashes on a 422/400 response', async () => {
    stubFetchJson(422, { error: 'boom: bad import' });
    await renderDiagram(<ImportModal onClose={() => {}} />, baseRaw());

    await scan();

    expect(screen.getByText(/boom: bad import/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /apply import/i })).toBeDisabled();
  });
});
