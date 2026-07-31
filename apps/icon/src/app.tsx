import { useEffect, useState } from 'react';
import { cn } from '@tickets/ui';
import { Artboard } from './canvas/artboard';
import { CanvasFooter } from './canvas/canvas-footer';
import { EditorProvider, useEditor } from './editor-context';
import { ObjectList } from './rails/object-list';
import { PropsPanel } from './rails/props-panel';
import { TopBar } from './topbar/top-bar';
import { useShortcuts } from './use-shortcuts';
import { chromeIsDim } from './view';

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

  useShortcuts({
    state,
    dispatch,
    onSave: () => {},
    onExport: () => setExportOpen(true),
  });

  const dim = chromeIsDim(view);

  return (
    <div className="flex h-screen flex-col bg-gray-1 font-sans text-gray-12">
      <TopBar dim={dim} onExport={() => setExportOpen(true)} exportOpen={exportOpen} onCloseExport={() => setExportOpen(false)} />

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

        <main className="relative flex min-w-0 flex-1 items-center justify-center bg-surface-field">
          <div className="relative mb-7 flex flex-none flex-col items-center gap-3">
            <Artboard />
          </div>
          <CanvasFooter status={status} />
        </main>

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
