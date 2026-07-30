import { useEffect, useReducer, useState } from 'react';
import { Button } from '@tickets/ui';
import { fetchConfig, generate } from './api';
import { adjust, NEUTRAL, type Adjust } from './color';
import { PRESETS, STICKS, type PresetName } from './config';
import { ControlsPanel } from './controls/controls-panel';
import { ElementPanel } from './controls/element-panel';
import { InkPanel } from './controls/ink-panel';
import { MotionPanel } from './controls/motion-panel';
import { DEFAULT_DOC, type IconDoc, type Ink } from './doc';
import { toDoc } from './migrate';
import { FileGrid } from './output/file-grid';
import type { MarkState } from './motion';
import { MotionPreview } from './output/motion-preview';
import type { GenerateResult } from './plugin/write';
import { INITIAL_STATE, studioReducer } from './state';

/** Every ink the vividness/brightness layer adjusts — every named ink except
 * the chip field, which is edited directly and never adjusted. */
function baseFrom(doc: IconDoc): Record<string, Ink> {
  const out: Record<string, Ink> = {};
  for (const [name, ink] of Object.entries(doc.inks)) {
    if (name !== 'field') out[name] = ink;
  }
  return out;
}

/**
 * `adjust` round-trips a colour through HSL, which does not promise to land
 * back on a byte-identical hex at every input — so passing `NEUTRAL` through
 * it is not itself a guarantee of returning to the exact original. Skipping
 * the round-trip at `NEUTRAL` is what actually makes that guarantee: the
 * non-compounding hazard `base` exists to prevent (see below) is worthless if
 * "back to neutral" can still land one bit off from where it started.
 */
function deriveHex(hex: string, a: Adjust): string {
  return a.hue === NEUTRAL.hue && a.sat === NEUTRAL.sat && a.lit === NEUTRAL.lit ? hex : adjust(hex, a);
}

export function Studio() {
  const [state, dispatch] = useReducer(studioReducer, INITIAL_STATE);
  const [results, setResults] = useState<GenerateResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Which state the loader is being driven to is a way of looking at the mark,
  // not a property of it, so it stays out of the document.
  const [loaderState, setLoaderState] = useState<MarkState>('default');

  // The picker-editable seed colours and the two vividness/brightness deltas
  // applied on top of them, one per theme. Kept outside the document for the
  // same reason `loaderState` is: this is a way of *looking at* the inks, not
  // a property of them. `base` is never itself overwritten by an adjustment —
  // only by a direct edit or a preset — and `doc.inks` is re-derived from
  // `base` + the deltas below from scratch on every change, so dragging
  // vividness back and forth (or resetting) always lands on exactly the
  // original colour instead of drifting further from it each time.
  const [base, setBase] = useState<Record<string, Ink>>(() => baseFrom(DEFAULT_DOC));
  const [adjLight, setAdjLight] = useState<Adjust>(NEUTRAL);
  const [adjDark, setAdjDark] = useState<Adjust>(NEUTRAL);

  // Reopen on whatever is committed, so the studio reflects the shipped icons.
  useEffect(() => {
    fetchConfig()
      .then((loaded) => {
        const doc = toDoc(loaded);
        setBase(baseFrom(doc));
        setAdjLight(NEUTRAL);
        setAdjDark(NEUTRAL);
        dispatch({ type: 'loadDoc', doc });
      })
      .catch((e: unknown) => {
        // Render the server's own message (which carries the `(EACCES)` or
        // parse detail — see icon-writer.ts's isFsError handling) rather
        // than a generic string that would discard it.
        setError(e instanceof Error ? e.message : 'Could not read icons.config.json.');
      });
  }, []);

  // Re-derive doc.inks from base + the two adjustments every time either
  // changes. Always starting from `base` (never from the document's current,
  // possibly already-adjusted ink) is what keeps this non-destructive.
  // `setInk` is a no-op for a name the document doesn't carry, so this only
  // ever touches inks `base` actually tracks.
  useEffect(() => {
    for (const [name, ink] of Object.entries(base)) {
      dispatch({
        type: 'setInk',
        name,
        patch: { light: deriveHex(ink.light, adjLight), dark: deriveHex(ink.dark, adjDark) },
      });
    }
  }, [base, adjLight, adjDark]);

  async function onGenerate() {
    setBusy(true);
    setError(null);
    try {
      const response = await generate(state.doc);
      setResults(response.results);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generate failed');
    } finally {
      setBusy(false);
    }
  }

  function onBaseChange(name: string, mode: 'light' | 'dark', hex: string) {
    setBase((prev) => {
      const existing = prev[name];
      if (!existing) return prev;
      return { ...prev, [name]: { ...existing, [mode]: hex } };
    });
  }

  function onAdjustChange(mode: 'light' | 'dark', patch: Partial<Adjust>) {
    (mode === 'light' ? setAdjLight : setAdjDark)((prev) => ({ ...prev, ...patch }));
  }

  function onResetAdjust() {
    setAdjLight(NEUTRAL);
    setAdjDark(NEUTRAL);
  }

  function onApplyPreset(name: PresetName) {
    const preset = PRESETS[name];
    const next: Record<string, Ink> = {};
    STICKS.forEach((stick, i) => {
      next[stick] = { light: preset.light[i] ?? '#000000', dark: preset.dark[i] ?? '#000000' };
    });
    setBase(next);
    setAdjLight(NEUTRAL);
    setAdjDark(NEUTRAL);
    dispatch({ type: 'setInk', name: 'field', patch: { light: preset.chip, dark: preset.chip } });
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
            <ElementPanel doc={state.doc} dispatch={dispatch} />
            <InkPanel doc={state.doc} base={base} onBaseChange={onBaseChange} />
            <ControlsPanel
              doc={state.doc}
              adjLight={adjLight}
              adjDark={adjDark}
              dispatch={dispatch}
              onAdjustChange={onAdjustChange}
              onResetAdjust={onResetAdjust}
              onApplyPreset={onApplyPreset}
            />
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

            <FileGrid doc={state.doc} />
          </div>
        </div>
      </div>
    </div>
  );
}
