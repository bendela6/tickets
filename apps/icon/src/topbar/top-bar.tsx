import { cn } from '@tickets/ui';
import { ZOOM_STEP } from '../doc/constants';
import { useEditor } from '../editor-context';
import { clampZoom } from '../view';
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
        'flex h-12 flex-none items-center gap-2.75 border-b-1 border-gray-6 pl-4 pr-3.25',
        dim && 'opacity-40',
      )}
    >
      <span aria-hidden className="size-2.5 flex-none rounded-sm bg-indigo-9" />

      <DocumentsPopover name={state.doc.name} documents={documents} now={now} />

      <span className="font-mono text-11 text-gray-9">
        {state.doc.size} × {state.doc.size}
      </span>

      {documents.dirty ? (
        <span className="flex flex-none items-center gap-1.5">
          <span aria-hidden className="size-1.25 flex-none rounded-full bg-gray-11" />
          <span className="font-mono text-10 text-gray-11">unsaved</span>
          <button
            type="button"
            onClick={documents.save}
            className="flex h-5.5 items-center gap-1.5 rounded-md border-1 border-gray-7 bg-surface-raised px-2 font-mono text-10 text-gray-12"
          >
            save ⌘S
          </button>
        </span>
      ) : (
        <span className="font-mono text-10 text-gray-9">saved {documents.savedAgo}</span>
      )}

      <span className="flex-1" />

      <div className="flex h-7 flex-none items-center overflow-hidden rounded-lg border-1 border-gray-6 bg-surface-raised">
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => setView((v) => ({ ...v, zoom: clampZoom(v.zoom - ZOOM_STEP) }))}
          className="h-6.5 w-6.75 text-14 text-gray-11"
        >
          −
        </button>
        <span className="w-12 text-center font-mono text-11 text-gray-11">{view.zoom}%</span>
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => setView((v) => ({ ...v, zoom: clampZoom(v.zoom + ZOOM_STEP) }))}
          className="h-6.5 w-6.75 text-14 text-gray-11"
        >
          +
        </button>
      </div>

      <button
        type="button"
        onClick={onExport}
        className="h-7.5 rounded-lg bg-indigo-9 px-3.75 font-sans text-12 font-500 text-indigo-contrast"
      >
        Export
      </button>
    </header>
  );
}
