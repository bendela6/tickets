// Dev-only tool: scan a drizzle schema module through the /api/drizzle/schema
// route (Task 8) and dry-run importDrizzle against the CURRENT model. Import is
// ALWAYS a dry run — Re-scan only fetches + diffs; nothing touches the diagram
// until "Apply import" is clicked. The report itself is the safety net (it
// shows exactly what will change and what each row means on the canvas), so
// Apply is a normal primary button, not a second confirmation.
//
// A construct describeDrizzle flagged as unsupported (relations(), a view, a
// $defaultFn(), …) — or a column whose type the catalogue doesn't know — is
// invisible to introspection: it CANNOT be preserved, only reported. The copy
// says exactly that ("cannot be reproduced — resolve before exporting"), never
// "kept verbatim" or "re-emitted unchanged" (see import-drizzle.ts's own
// header comment on why there's no safe way to round-trip what was never seen).

import { useState } from 'react';

import { importDrizzle, type ChangeRow, type ImportReport } from '../../engine/model/import-drizzle';
import type { Model } from '../../engine/model/types';
import type { SchemaDescription } from '../../node/describe-drizzle';
import { useDiagramActions, useDiagramModelOrNull, useDiagramUi } from '../../state/diagram-context';
import { cn } from '@tickets/ui/cn';
import { Modal } from '../modal';

// Mirrors DEFAULT_MODULE in vite-plugins/drizzle-api.ts — not imported from
// there directly: that module pulls in node:fs/ssrLoadModule surface that must
// never land in the browser bundle (see its own header comment).
const DEFAULT_MODULE = 'packages/db/src/schema/index.ts';

const field = cn('w-full rounded-md border border-gray-600 bg-gray-900 px-2 py-1', 'text-sm text-gray-50');
const label = 'flex flex-col gap-1 text-xs text-gray-400';
const errorRow = cn('flex items-start justify-between gap-2 rounded-md border border-red-600', 'bg-red-950 px-2 py-1 text-sm text-red-400');
const rescanBtn = 'rounded-md border border-gray-600 px-3 py-2 text-sm text-gray-50 hover:bg-gray-700';
const applyBtn = cn('rounded-md bg-blue-600 px-3 py-2 text-sm text-gray-50 hover:bg-blue-500', 'disabled:opacity-50');
const sectionHead = 'text-2xs font-semibold uppercase tracking-widest text-gray-400';
const changeRow = 'flex items-start gap-2 text-sm text-gray-50';
const tableBadge = cn('inline-block w-32 shrink-0 truncate rounded bg-gray-900 px-2 py-1', 'font-mono text-2xs text-gray-50');
const warnBox = cn('flex flex-col gap-1 rounded-md border border-yellow-600', 'bg-yellow-950 px-2 py-2 text-sm text-yellow-400');

interface ScanResult {
  model: Model;
  report: ImportReport;
}

async function fetchSchema(modulePath: string): Promise<{ desc: SchemaDescription } | { error: string }> {
  try {
    const res = await fetch(`/api/drizzle/schema?module=${encodeURIComponent(modulePath)}`, { cache: 'no-store' });
    const body = (await res.json().catch(() => null)) as { error?: string } | SchemaDescription | null;
    if (!res.ok) return { error: (body as { error?: string } | null)?.error ?? `HTTP ${res.status}` };
    return { desc: body as SchemaDescription };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

function countsLine(report: ImportReport): string {
  return `${report.addedTables.length} added · ${report.changedTables.length} changed · ${report.removedTables.length} removed`;
}

export function ImportModal({ onClose }: { onClose: () => void }) {
  const model = useDiagramModelOrNull();
  const ui = useDiagramUi();
  const actions = useDiagramActions();

  const [modulePath, setModulePath] = useState(DEFAULT_MODULE);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);

  const scan = async () => {
    setScanning(true);
    setError(null);
    setResult(null);
    const fetched = await fetchSchema(modulePath);
    if ('error' in fetched) {
      setError(fetched.error);
      setScanning(false);
      return;
    }
    try {
      const { model: merged, report } = importDrizzle(fetched.desc, model);
      setResult({ model: merged, report });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setScanning(false);
  };

  const apply = () => {
    if (!result) return;
    actions.load(result.model, ui.modelId ?? undefined);
    onClose();
  };

  const report = result?.report ?? null;
  const unsupportedCount = report ? report.unsupported.length + report.unknownTypes.length : 0;

  return (
    <Modal title="Import from drizzle" onClose={onClose} size="wide">
      <label className={label}>
        Module path
        <input className={field} value={modulePath} onChange={(e) => setModulePath(e.target.value)} />
      </label>

      <div className="flex justify-end">
        <button type="button" className={rescanBtn} disabled={scanning} onClick={() => void scan()}>
          {scanning ? 'Scanning…' : 'Re-scan'}
        </button>
      </div>

      {error && (
        <div className={errorRow}>
          <span>{error}</span>
          <button type="button" className="shrink-0" onClick={() => setError(null)} aria-label="Dismiss error">
            ×
          </button>
        </div>
      )}

      {report && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-gray-200">{countsLine(report)}</p>

          <ReportSection title="+ ADDED" rows={report.addedTables} />
          <ReportSection title="~ CHANGED" rows={report.changedTables} />
          <ReportSection title="− REMOVED" rows={report.removedTables} />

          {unsupportedCount > 0 && (
            <div className={warnBox}>
              <p className="font-semibold">
                {unsupportedCount} construct{unsupportedCount === 1 ? '' : 's'} cannot be reproduced — resolve before
                exporting
              </p>
              <ul className="ml-4 list-disc">
                {report.unknownTypes.map((u, i) => (
                  <li key={`u${i}`}>
                    {u.table}.{u.column}: unknown type "{u.type}"
                  </li>
                ))}
                {report.unsupported.map((u, i) => (
                  <li key={`c${i}`}>
                    {u.where}: {u.detail}
                  </li>
                ))}
              </ul>
              {report.blocksExport && <p>Export is blocked until these are resolved.</p>}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end pt-2">
        <button type="button" className={applyBtn} disabled={!result} onClick={apply}>
          Apply import
        </button>
      </div>
    </Modal>
  );
}

function ReportSection({ title, rows }: { title: string; rows: ChangeRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <p className={sectionHead}>{title}</p>
      {rows.map((r) => (
        <div key={r.table} className={changeRow}>
          <span className={tableBadge}>{r.table}</span>
          <span className="text-gray-200">{r.canvasEffect}</span>
        </div>
      ))}
    </div>
  );
}
