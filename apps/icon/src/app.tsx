import { useEffect, useRef, useState } from 'react';
import { cn } from '@tickets/ui';
import { Artboard } from './canvas/artboard';
import { CanvasFooter } from './canvas/canvas-footer';
import { EditorProvider, useEditor } from './editor-context';
import { ExportDialog } from './export/export-dialog';
import { useDocuments } from './topbar/use-documents';
import { ObjectList } from './rails/object-list';
import { PropsPanel } from './rails/props-panel';
import { TopBar } from './topbar/top-bar';
import { HeldPoses } from './transport/held-poses';
import { Transport } from './transport/transport';
import { useShortcuts } from './use-shortcuts';
import { chromeIsDim, steppedZoom } from './view';

/** How long the status slot echoes an action before falling back to the selection line. */
const ECHO_MS = 2000;

/**
 * The one screen.
 *
 * Layout is fixed by the design: a 48px top bar, then three columns — a 232px
 * object rail, the canvas field, and a 264px properties rail. The rails sit on
 * the app background with no fill and no card; the only thing separating them
 * from the canvas is a hairline and the fact that the canvas field is
 * *recessed* rather than raised. The artboard inside it is the single bright
 * surface on screen.
 */
export function App() {
  return (
    <EditorProvider>
      <Editor />
    </EditorProvider>
  );
}

function Editor() {
  const { state, dispatch, view } = useEditor();
  const [exportOpen, setExportOpen] = useState(false);
  const status = useActionEcho();
  const documents = useDocuments({ state, dispatch });
  const now = useNow(documents.savedAgo);

  useShortcuts({
    state,
    dispatch,
    onSave: documents.save,
    onExport: () => setExportOpen(true),
  });

  const dim = chromeIsDim(view);

  return (
    <div className="flex h-screen flex-col bg-gray-1 font-sans text-gray-12">
      <TopBar dim={dim} documents={documents} now={now} onExport={() => setExportOpen(true)} />
      {exportOpen ? <ExportDialog onClose={() => setExportOpen(false)} /> : null}

      <div className="flex min-h-0 flex-1">
        <aside
          aria-label="Objects"
          className={cn(
            'flex w-58 flex-none flex-col border-r-1 border-gray-6',
            dim && 'opacity-40',
          )}
        >
          <ObjectList />
        </aside>

        <CanvasField status={status} />

        <aside
          aria-label="Properties"
          className={cn(
            'w-66 flex-none overflow-auto border-l-1 border-gray-6',
            dim && 'opacity-40',
          )}
        >
          <PropsPanel />
        </aside>
      </div>
    </div>
  );
}

/**
 * The canvas region.
 *
 * It scrolls, because the artboard is now any size at any zoom and a 4096
 * board at 800% has to be reachable. That is also why the wheel is left alone
 * for scrolling and zoom is on ⌘/Ctrl + wheel: hijacking a plain wheel would
 * take away the only way to pan.
 */
function CanvasField({ status }: { status: string }) {
  const { setView } = useEditor();
  const region = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = region.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      // Without this the browser's own page zoom takes the gesture.
      event.preventDefault();
      setView((v) => ({ ...v, zoom: steppedZoom(v.zoom, event.deltaY < 0 ? 1 : -1) }));
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [setView]);

  return (
    <main className="relative min-w-0 flex-1 bg-surface-field">
      {/* The scroller is a layer inside the region rather than the region
          itself, so the footer below stays pinned. Absolute positioning is
          relative to the padding box, so a footer inside the scroller would
          scroll away with the artboard — which it did. */}
      <div
        ref={region}
        className="absolute inset-0 flex items-center justify-center overflow-auto"
      >
        <div className="relative m-auto flex flex-none flex-col items-center gap-3 p-8 pb-16">
          <Artboard />
          <Transport />
          <HeldPoses />
        </div>
      </div>
      <CanvasFooter status={status} />
    </main>
  );
}

/**
 * A clock that ticks only while something is actually shown relative to it.
 * `saved 2m ago` has to become `3m ago` on its own, but a document that has
 * never been saved reads `never` and needs no re-render at all.
 */
function useNow(savedAgo: string): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (savedAgo === 'never') return;
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [savedAgo]);
  return now;
}

/**
 * Undo's only feedback. The status slot already exists, so it echoes the
 * action for a moment and then returns to the selection line — which is why
 * the design has no undo button and no history panel.
 */
function useActionEcho(): string {
  const { state } = useEditor();
  const [echo, setEcho] = useState('');
  const label = state.lastAction?.label ?? '';

  useEffect(() => {
    if (!label.startsWith('undid') && !label.startsWith('redid')) return;
    setEcho(label);
    const timer = setTimeout(() => setEcho(''), ECHO_MS);
    return () => clearTimeout(timer);
  }, [label, state.past.length, state.future.length]);

  return echo;
}
