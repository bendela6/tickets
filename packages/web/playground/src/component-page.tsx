import { useCallback, useRef, useState } from 'react';
import { Group, Panel, Separator, type Layout } from 'react-resizable-panels';
import { cn } from '@tickets/ui/cn';
import { initialValues, type CollectedDemo } from '@tickets/ui/gallery';
import { A11yTab } from './a11y-tab';
import { getAxe } from './axe';
import { CodeTab } from './code-tab';
import { ControlsPanel } from './controls-panel';
import { loadLayout, saveLayout } from './persisted-layout';
import { MatrixMode } from './matrix-mode';
import { PlaygroundCard } from './playground-card';
import { PropsTable } from './props-table';
import { SourceTab } from './source-tab';
import { StateGrid } from './state-grid';
import { ThemeSplit } from './theme-split';

// v4's replacement for v2's `autoSaveId`: the app owns storage. Panel ids
// below ("stage" / "controls") must stay stable — they're the keys `Layout`
// persists under.
const WORKBENCH_LAYOUT_KEY = 'playground-workbench';

type LiveDemo = Extract<CollectedDemo, { slug: string }>;

const TABS = [
  { key: 'preview', label: 'Preview' },
  { key: 'code', label: 'Code' },
  { key: 'source', label: 'Source' },
  { key: 'a11y', label: 'A11y' },
] as const;

type TabKey = (typeof TABS)[number]['key'];


// One component's doc page (design: docs/design/pulls/playground-workbench.dc.html
// lines 103-188). Underline tab strip over Preview/Code/Source/A11y; Preview
// splits into a resizable stage (states + playground + props) and a controls
// rail. Non-active tabs stay mounted (`hidden`, not unmounted) so playground
// values survive switching away and back — verified by component-page.test.tsx.
export function ComponentPage({ demo, source }: { demo: LiveDemo; source?: string }) {
  const [tab, setTab] = useState<TabKey>('preview');
  const { playground } = demo;
  const [values, setValues] = useState<Record<string, unknown>>(() =>
    playground ? initialValues(playground.controls) : {},
  );
  const [defaultLayout] = useState<Layout | undefined>(() => loadLayout(WORKBENCH_LAYOUT_KEY));
  const [splitThemes, setSplitThemes] = useState(false);
  const [matrixMode, setMatrixMode] = useState(false);
  const [auditing, setAuditing] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  // axe-core's default excludeHidden skips display:none subtrees entirely,
  // so the preview must be genuinely visible while the audit walks it — the
  // a11y tab's `hidden` wrapper below is temporarily overridden by
  // `auditing`. The double-rAF gives React a chance to commit the unhidden
  // wrapper and the browser a chance to flush layout/styles before axe
  // reads them; jsdom's rAF works for this, but fall back to a macrotask if
  // it's ever unavailable.
  const runAudit = useCallback(async () => {
    setAuditing(true);
    try {
      await new Promise<void>((resolve) => {
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        } else {
          setTimeout(resolve, 0);
        }
      });
      const axe = await getAxe();
      return await axe(previewRef.current!);
    } finally {
      setAuditing(false);
    }
  }, []);

  // Get select control keys for matrix mode
  const selectKeys = playground
    ? Object.entries(playground.controls)
        .filter(([, def]) => def.kind === 'select')
        .map(([key]) => key)
    : [];
  const [matrixX, setMatrixX] = useState(selectKeys[0] ?? '');
  const [matrixY, setMatrixY] = useState(selectKeys[1] ?? '');

  // Axes must never land on the same key. If the newly picked key is
  // already the other axis's key, swap: the other axis takes this axis's
  // previous value instead of colliding with it.
  const handleXKeyChange = (key: string) => {
    if (key === matrixY) setMatrixY(matrixX);
    setMatrixX(key);
  };
  const handleYKeyChange = (key: string) => {
    if (key === matrixX) setMatrixX(matrixY);
    setMatrixY(key);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-6 border-b border-hairline pb-2">
        <div className="flex gap-6">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                'border-b-2 pb-2 font-sans text-ui',
                tab === key
                  ? '-mb-px border-accent font-medium text-ink'
                  : 'border-transparent text-ink-3 hover:text-ink',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === 'preview' && playground && (
          <div className="flex items-center gap-4">
            {/* Split themes toggle */}
            <label className="flex items-center gap-2 font-sans text-ui text-ink-2 cursor-pointer">
              <input
                type="checkbox"
                checked={splitThemes}
                onChange={(e) => setSplitThemes(e.target.checked)}
                className="sr-only"
              />
              <span
                className={cn(
                  'inline-block w-8 h-4.5 rounded-full relative',
                  splitThemes ? 'bg-accent' : 'bg-control',
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 w-3.5 h-3.5 rounded-full bg-raised transition-all',
                    splitThemes ? 'right-0.5' : 'left-0.5',
                  )}
                />
              </span>
              <span>Split themes</span>
            </label>

            {/* Matrix mode toggle - only visible if ≥2 select controls */}
            {selectKeys.length >= 2 && (
              <label className="flex items-center gap-2 font-sans text-ui text-ink-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={matrixMode}
                  onChange={(e) => setMatrixMode(e.target.checked)}
                  className="sr-only"
                />
                <span
                  className={cn(
                    'inline-block w-8 h-4.5 rounded-full relative',
                    matrixMode ? 'bg-accent' : 'bg-control',
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 w-3.5 h-3.5 rounded-full bg-raised transition-all',
                      matrixMode ? 'right-0.5' : 'left-0.5',
                    )}
                  />
                </span>
                <span>Matrix</span>
              </label>
            )}
          </div>
        )}
      </div>

      <div className={tab === 'preview' || auditing ? '' : 'hidden'}>
        {playground ? (
          <Group
            id="playground-workbench"
            orientation="horizontal"
            defaultLayout={defaultLayout}
            onLayoutChanged={(layout, meta) => {
              if (meta.isUserInteraction) saveLayout(WORKBENCH_LAYOUT_KEY, layout);
            }}
          >
            <Panel id="stage" defaultSize="70">
              <div className="flex flex-col gap-6 pr-6">
                {matrixMode ? (
                  <MatrixMode
                    playground={playground}
                    values={values}
                    xKey={matrixX}
                    yKey={matrixY}
                    onXKeyChange={handleXKeyChange}
                    onYKeyChange={handleYKeyChange}
                  />
                ) : splitThemes ? (
                  <ThemeSplit render={() => <StateGrid demo={demo} />} />
                ) : (
                  <StateGrid demo={demo} />
                )}
                <PlaygroundCard ref={previewRef} playground={playground} values={values} />
                <div className="flex flex-col gap-2.5">
                  <div className="font-mono text-label uppercase tracking-(--tracking-caps) text-ink-3">
                    PROPS
                  </div>
                  <PropsTable controls={playground.controls} />
                </div>
              </div>
            </Panel>
            <Separator className="workbench-resize-handle" />
            <Panel id="controls" defaultSize="30" minSize="20" maxSize="34">
              <div className="flex h-full flex-col pl-6">
                <div className="flex items-center justify-between pb-2.5">
                  <span className="font-mono text-label uppercase tracking-(--tracking-caps) text-ink-3">
                    CONTROLS
                  </span>
                  <button
                    type="button"
                    onClick={() => setValues(initialValues(playground.controls))}
                    className="font-sans text-label font-medium text-accent hover:underline"
                  >
                    Reset
                  </button>
                </div>
                <ControlsPanel
                  controls={playground.controls}
                  values={values}
                  onChange={(key, value) => setValues((v) => ({ ...v, [key]: value }))}
                />
                <p className="mt-3 font-sans text-label text-ink-3">
                  Unset props fall back to the component default and are omitted from generated
                  code.
                </p>
              </div>
            </Panel>
          </Group>
        ) : (
          <StateGrid demo={demo} />
        )}
      </div>


      <div className={tab === 'code' ? '' : 'hidden'}>
        <CodeTab demo={demo} values={values} />
      </div>
      <div className={tab === 'source' ? '' : 'hidden'}>
        <SourceTab demo={demo} source={source} />
      </div>
      <div className={tab === 'a11y' ? '' : 'hidden'}>
        {playground && <A11yTab runAudit={runAudit} />}
      </div>
    </div>
  );
}
