// Dev-only tool: preview the drizzle TS source exportDrizzle(model) would
// produce, and POST it to the /api/drizzle/export route (Task 8) to write it
// under apps/eer/exports/. "Write file" is disabled — with the reason shown —
// whenever the model has an unknown column type or an unreproducible
// construct: exportDrizzle THROWS in that case (see its own header comment),
// so the block is derived by actually calling it and catching the message,
// never by re-deciding "is this exportable" a second time.

import { useMemo, useState } from 'react';

import { exportDrizzle } from '../../engine/model/export-drizzle';
import { useDiagramModelOrNull } from '../../state/diagram-context';
import { cn } from '@tickets/ui/cn';
import { Modal } from '../modal';

const field = cn('w-full rounded-md border border-gray-600 bg-gray-900 px-2 py-1', 'text-sm text-gray-50');
const label = 'flex flex-col gap-1 text-xs text-gray-400';
const errorRow = cn('flex items-start justify-between gap-2 rounded-md border border-red-600', 'bg-red-950 px-2 py-1 text-sm text-red-400');
const blockRow = cn('flex items-start gap-2 rounded-md border border-yellow-600', 'bg-yellow-950 px-2 py-1 text-sm text-yellow-400');
const noticeRow = 'text-xs text-gray-400';
// The ONE sanctioned inner horizontal scroll (overflow-x-auto): a generated
// column/constraint line can be far wider than the modal, and wrapping it
// would make the SQL harder to read, not easier.
const previewWell = cn('max-h-96 overflow-x-auto overflow-y-auto rounded-md bg-gray-950 p-3', 'font-mono text-xs whitespace-pre text-gray-200');
const writeBtn = cn('rounded-md bg-blue-600 px-3 py-2 text-sm text-gray-50 hover:bg-blue-500', 'disabled:opacity-50');

export function ExportModal({ onClose }: { onClose: () => void }) {
  const model = useDiagramModelOrNull();

  const [filename, setFilename] = useState('schema.generated.ts');
  const [writing, setWriting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [writtenPath, setWrittenPath] = useState<string | null>(null);

  const { source, blockReason } = useMemo(() => {
    if (!model) return { source: null, blockReason: 'No model is loaded.' };
    try {
      return { source: exportDrizzle(model), blockReason: null as string | null };
    } catch (err) {
      return { source: null, blockReason: err instanceof Error ? err.message : String(err) };
    }
  }, [model]);

  const write = async () => {
    if (!source) return;
    setWriting(true);
    setError(null);
    setWrittenPath(null);
    try {
      const res = await fetch('/api/drizzle/export', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ filename, source }),
      });
      const body = (await res.json().catch(() => null)) as { path?: string; error?: string } | null;
      if (!res.ok) setError(body?.error ?? `HTTP ${res.status}`);
      else setWrittenPath(body?.path ?? filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWriting(false);
    }
  };

  return (
    <Modal title="Export to drizzle" onClose={onClose} size="wide">
      <label className={label}>
        Target file
        <input className={field} value={filename} onChange={(e) => setFilename(e.target.value)} />
      </label>

      {blockReason && (
        <div className={blockRow}>
          <span>Export is blocked — {blockReason}</span>
        </div>
      )}

      {error && (
        <div className={errorRow}>
          <span>{error}</span>
          <button type="button" className="shrink-0" onClick={() => setError(null)} aria-label="Dismiss error">
            ×
          </button>
        </div>
      )}

      <pre className={previewWell}>{source ?? ''}</pre>

      {writtenPath && <p className={noticeRow}>Wrote {writtenPath}</p>}

      <div className="flex justify-end pt-2">
        <button type="button" className={writeBtn} disabled={!source || writing} title={blockReason ?? undefined} onClick={() => void write()}>
          {writing ? 'Writing…' : 'Write file'}
        </button>
      </div>
    </Modal>
  );
}
