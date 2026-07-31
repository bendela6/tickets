import { cn } from '@tickets/ui';
import { ZOOM_STEP } from '../doc/constants';
import { useEditor } from '../editor-context';
import { clampZoom } from '../view';

/**
 * The top bar. The document name is the control rather than gaining one, the
 * zoom stepper reads its own value, and Export is one of the three places
 * accent is spent.
 */
export function TopBar({
  dim,
  onExport,
}: {
  dim: boolean;
  onExport: () => void;
  exportOpen?: boolean;
  onCloseExport?: () => void;
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

      <span className="font-mono text-13 font-500 tracking-tight text-gray-12">
        {state.doc.name}
      </span>
      <span className="font-mono text-11 text-gray-9">
        {state.doc.size} × {state.doc.size}
      </span>

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
