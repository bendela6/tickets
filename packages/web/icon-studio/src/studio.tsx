import { useEffect, useMemo, useReducer, useState } from 'react';
import { Button } from '@tickets/ui';
import { fetchConfig, generate } from './api';
import { ControlsPanel } from './controls/controls-panel';
import { FileGrid } from './output/file-grid';
import type { GenerateResult } from './plugin/write';
import { INITIAL_STATE, studioReducer, toConfig } from './state';

export function Studio() {
  const [state, dispatch] = useReducer(studioReducer, INITIAL_STATE);
  const [results, setResults] = useState<GenerateResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const config = useMemo(() => toConfig(state), [state]);

  // Reopen on whatever is committed, so the studio reflects the shipped icons.
  useEffect(() => {
    fetchConfig()
      .then((loaded) => dispatch({ type: 'loadConfig', config: loaded }))
      .catch(() => setError('Could not read icons.config.json — showing defaults.'));
  }, []);

  async function onGenerate() {
    setBusy(true);
    setError(null);
    try {
      const response = await generate(config);
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

        <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
          <ControlsPanel state={state} config={config} dispatch={dispatch} />

          <div className="flex flex-col gap-4">
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

            <FileGrid config={config} />
          </div>
        </div>
      </div>
    </div>
  );
}
