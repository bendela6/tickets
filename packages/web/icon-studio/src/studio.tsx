import { useEffect, useReducer, useState } from 'react';
import { Button } from '@tickets/ui';
import { fetchConfig, generate } from './api';
import type { MarkConfig } from './config';
import { DEFAULT_CONFIG } from './config';
import { ControlsPanel } from './controls/controls-panel';
import { MotionPanel } from './controls/motion-panel';
import { toDoc } from './migrate';
import { FileGrid } from './output/file-grid';
import type { MarkState } from './motion';
import { MotionPreview } from './output/motion-preview';
import type { GenerateResult } from './plugin/write';
import { INITIAL_STATE, studioReducer } from './state';

export function Studio() {
  const [state, dispatch] = useReducer(studioReducer, INITIAL_STATE);
  const [results, setResults] = useState<GenerateResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Which state the loader is being driven to is a way of looking at the mark,
  // not a property of it, so it stays out of the document.
  const [loaderState, setLoaderState] = useState<MarkState>('default');

  // Generate, FileGrid and the raster pipeline still walk the old
  // MarkConfig -> generate/svg.ts path — that cutover is a later task, and
  // svg.ts is off limits here. So the raw config fetched on mount is kept
  // alongside the live document: it drives the output previews and Generate,
  // while `state.doc` (migrated from the same fetch via `toDoc`) drives the
  // panels below. The two intentionally fall out of sync once the document is
  // edited; reconnecting Generate to the live document is that later task's
  // job, not this one's.
  const [rawConfig, setRawConfig] = useState<MarkConfig>(DEFAULT_CONFIG);

  // Reopen on whatever is committed, so the studio reflects the shipped icons.
  useEffect(() => {
    fetchConfig()
      .then((loaded) => {
        setRawConfig(loaded);
        dispatch({ type: 'loadDoc', doc: toDoc(loaded) });
      })
      .catch((e: unknown) => {
        // Render the server's own message (which carries the `(EACCES)` or
        // parse detail — see icon-writer.ts's isFsError handling) rather
        // than a generic string that would discard it.
        setError(e instanceof Error ? e.message : 'Could not read icons.config.json.');
      });
  }, []);

  async function onGenerate() {
    setBusy(true);
    setError(null);
    try {
      const response = await generate(rawConfig);
      setResults(response.results);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generate failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-1 font-sans text-gray-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-24 font-600 tracking-tight">Icon studio</h1>
          <p className="max-w-prose text-13 text-gray-11">
            Tune the mark, then write every favicon and install icon into apps/web. The config is
            the source of truth; the icons are generated from it.
          </p>
        </header>

        {error ? (
          <p role="status" className="rounded-lg border-1 border-pink-6 bg-pink-2 px-3 py-2 text-13 text-pink-11">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="flex flex-col gap-5 lg:w-88 lg:shrink-0">
            <ControlsPanel doc={state.doc} dispatch={dispatch} />
            <MotionPanel
              doc={state.doc}
              state={loaderState}
              dispatch={dispatch}
              onState={setLoaderState}
            />
          </div>

          <div className="flex flex-col gap-4 lg:flex-1">
            <div className="flex items-center gap-3">
              <Button variant="solid" onClick={onGenerate} loading={busy}>
                Generate all icons
              </Button>
              {results ? (
                <span className="font-mono text-12 text-gray-11">
                  {results.filter((r) => r.status === 'written').length} written ·{' '}
                  {results.filter((r) => r.status === 'unchanged').length} unchanged ·{' '}
                  {results.filter((r) => r.status === 'rejected').length} rejected
                </span>
              ) : null}
            </div>

            {results ? (
              <ul className="flex flex-col gap-1 rounded-lg border-1 border-gray-6 bg-gray-2 p-3">
                {results.map((r) => (
                  <li key={r.path} className="font-mono text-12 text-gray-11">
                    <span className="text-gray-12">{r.status}</span> {r.path}
                    {r.reason ? ` — ${r.reason}` : ''}
                  </li>
                ))}
              </ul>
            ) : null}

            <section className="flex flex-col gap-2 rounded-lg border-1 border-gray-6 bg-gray-2 p-3">
              <h2 className="font-mono text-11 uppercase tracking-wider text-gray-11">
                Loader
              </h2>
              <MotionPreview doc={state.doc} state={loaderState} />
            </section>

            <FileGrid config={rawConfig} />
          </div>
        </div>
      </div>
    </div>
  );
}
