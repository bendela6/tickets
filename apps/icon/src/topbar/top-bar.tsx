import { cn } from '@tickets/ui';
import { useEditor } from '../editor-context';
import { steppedZoom } from '../view';
import { DocumentsPopover } from './documents-popover';
import type { Documents } from './use-documents';

/**
 * The top bar.
 *
 * Unsaved work reads as a neutral dot and the word `unsaved`, with a small
 * save button that appears only while dirty; when clean the same slot reads
 * `saved 2m ago`, so the row never changes width class. Export is one of the
 * three places accent is spent.
 */
export function TopBar({
  dim,
  documents,
  now,
  onExport,
}: {
  dim: boolean;
  documents: Documents;
  now: number;
  onExport: () => void;
}) {
  const { state, view, setView } = useEditor();

  return (
    <header
      className={cn(
        'flex h-48 flex-none items-center gap-11 border-b-1 border-gray-6 pl-16 pr-13',
        dim && 'opacity-40',
      )}
    >
      <span aria-hidden className="size-10 flex-none rounded-sm bg-indigo-9" />

      <DocumentsPopover name={state.doc.name} documents={documents} now={now} />

      <span className="font-mono text-11 text-gray-9">
        {state.doc.artboard.width} × {state.doc.artboard.height}
      </span>

      {documents.dirty ? (
        <span className="flex flex-none items-center gap-6">
          <span aria-hidden className="size-5 flex-none rounded-full bg-gray-11" />
          <span className="font-mono text-10 text-gray-11">unsaved</span>
          <button
            type="button"
            onClick={documents.save}
            className="flex h-22 items-center gap-6 rounded-md border-1 border-gray-7 bg-surface-raised px-8 font-mono text-10 text-gray-12"
          >
            save ⌘S
          </button>
        </span>
      ) : (
        <span className="font-mono text-10 text-gray-9">saved {documents.savedAgo}</span>
      )}

      <span className="flex-1" />

      <div className="flex h-28 flex-none items-center overflow-hidden rounded-lg border-1 border-gray-6 bg-surface-raised">
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => setView((v) => ({ ...v, zoom: steppedZoom(v.zoom, -1) }))}
          className="h-26 w-27 text-14 text-gray-11"
        >
          −
        </button>
        <button
          type="button"
          aria-label="Reset zoom"
          title="Reset to 100% · ⌘0 — fit the board ⇧⌘0"
          onClick={() => setView((v) => ({ ...v, zoom: 100 }))}
          className="w-48 text-center font-mono text-11 text-gray-11"
        >
          {/* The stored zoom is fractional because the wheel is continuous;
              only the readout is whole. */}
          {Math.round(view.zoom)}%
        </button>
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => setView((v) => ({ ...v, zoom: steppedZoom(v.zoom, 1) }))}
          className="h-26 w-27 text-14 text-gray-11"
        >
          +
        </button>
      </div>

      <button
        type="button"
        onClick={onExport}
        className="h-30 rounded-lg bg-indigo-9 px-15 font-sans text-12 font-500 text-indigo-contrast"
      >
        Export
      </button>
    </header>
  );
}
