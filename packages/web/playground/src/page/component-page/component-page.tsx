import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Group,
  Panel,
  Separator,
  type Layout,
  type PanelImperativeHandle,
} from 'react-resizable-panels';
import { cn, type CollectedDemo, Icon, initialValues, Tabs } from '@tickets/ui';
import { A11yTab } from '../tabs/a11y-tab';
import { getAxe } from '../tabs/a11y-tab/axe';
import { ControlsPanel } from '../../preview/controls-panel';
import { DemoTab } from '../tabs/demo-tab';
import { DocsPanel } from '../tabs/docs-panel';
import { GeneratedCode } from '../../code/generated-code';
import { ImplTab, type ImplSources } from '../tabs/impl-tab';
import { loadFlag, loadLayout, saveFlag, saveLayout } from '../../shell/persisted-layout';
import { MatrixMode } from '../tabs/matrix-mode';
import { PlaygroundCard } from '../../preview/playground-card';
import { StateGrid } from '../../preview/state-grid';
import { ThemeSplit } from '../../shell/theme-split';

// v4's replacement for v2's `autoSaveId`: the app owns storage. Panel ids
// below ("stage" / "controls") must stay stable — they're the keys `Layout`
// persists under. The `-v2` suffix retires layouts saved against the old
// percentage-based rail, which read as far too wide once the shell went
// full-bleed.
const WORKBENCH_LAYOUT_KEY = 'playground-workbench-v2';
const WORKBENCH_COLLAPSED_KEY = 'playground-workbench-collapsed';

type LiveDemo = Extract<CollectedDemo, { slug: string }>;

const TABS = [
  { key: 'preview', label: 'Preview' },
  { key: 'docs', label: 'Docs' },
  { key: 'impl', label: 'Implementation' },
  { key: 'demo', label: 'Demo' },
  { key: 'a11y', label: 'A11y' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 font-sans text-13/19 text-gray-11">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span
        className={cn(
          'relative inline-block h-4.5 w-8 rounded-full',
          checked ? 'bg-indigo-9' : 'bg-gray-7',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-3.5 w-3.5 rounded-full bg-surface-raised transition-all',
            checked ? 'right-0.5' : 'left-0.5',
          )}
        />
      </span>
      <span>{label}</span>
    </label>
  );
}

// One component's doc page. Underline tab strip over
// Preview/Props/Implementation/Demo/A11y; Preview splits into a resizable
// stage (states + playground + the generated code for the current controls)
// and a collapsible controls rail. Non-active tabs stay mounted (`hidden`,
// not unmounted) so playground values survive switching away and back —
// verified by component-page.test.tsx.
function isTabKey(value: string | null | undefined): value is TabKey {
  return TABS.some((t) => t.key === value);
}

export function ComponentPage({
  demo,
  source,
  implSources,
  initialTab,
}: {
  demo: LiveDemo;
  source?: string;
  implSources?: ImplSources;
  /** Tab named by the hash (`#pill::impl`); ignored when it isn't a real tab. */
  initialTab?: string | null;
}) {
  const [tab, setTab] = useState<TabKey>(() => (isTabKey(initialTab) ? initialTab : 'preview'));
  // A later hash change targeting the same component can't remount this (it's
  // keyed by slug), so follow the prop rather than only seeding from it.
  useEffect(() => {
    if (isTabKey(initialTab)) setTab(initialTab);
  }, [initialTab]);
  const { playground } = demo;
  const [values, setValues] = useState<Record<string, unknown>>(() =>
    playground ? initialValues(playground.controls) : {},
  );
  const [defaultLayout] = useState<Layout | undefined>(() => loadLayout(WORKBENCH_LAYOUT_KEY));
  const [splitThemes, setSplitThemes] = useState(false);
  const [matrixMode, setMatrixMode] = useState(false);
  const [auditing, setAuditing] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  // The rail's collapsed-ness is ours to drive (button) and the library's to
  // report (drag past minSize), so it lives in React state and is pushed into
  // the panel imperatively — the panel has no controlled `collapsed` prop.
  const controlsRef = useRef<PanelImperativeHandle | null>(null);
  const [controlsCollapsed, setControlsCollapsed] = useState(
    () => loadFlag(WORKBENCH_COLLAPSED_KEY) ?? false,
  );
  useEffect(() => {
    const panel = controlsRef.current;
    if (!panel) return;
    if (controlsCollapsed !== panel.isCollapsed()) {
      if (controlsCollapsed) panel.collapse();
      else panel.expand();
    }
  }, [controlsCollapsed]);

  function setCollapsed(next: boolean) {
    setControlsCollapsed(next);
    saveFlag(WORKBENCH_COLLAPSED_KEY, next);
  }

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
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-gray-6 pb-2">
        <Tabs
          variant="underline"
          label={`${demo.meta.title} views`}
          className="border-b-0"
          items={TABS.map(({ key, label }) => ({ value: key, label }))}
          value={tab}
          onChange={(next) => setTab(next as TabKey)}
        />
        {tab === 'preview' && playground && (
          <div className="flex items-center gap-4">
            <Toggle label="Split themes" checked={splitThemes} onChange={setSplitThemes} />
            {/* Matrix mode toggle - only visible if ≥2 select controls */}
            {selectKeys.length >= 2 && (
              <Toggle label="Matrix" checked={matrixMode} onChange={setMatrixMode} />
            )}
            <button
              type="button"
              aria-expanded={!controlsCollapsed}
              onClick={() => setCollapsed(!controlsCollapsed)}
              className="inline-flex h-6.5 items-center gap-1.5 rounded-md border border-gray-7 bg-surface-raised px-2 font-sans text-11/13 tracking-wider font-500 text-gray-11 hover:text-gray-12"
            >
              <Icon name={controlsCollapsed ? 'chevron-left' : 'chevron-right'} size="sm" />
              {controlsCollapsed ? 'Show controls' : 'Hide controls'}
            </button>
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
            <Panel id="stage">
              {/* Playground first, then its code, then the states. The live
                  specimen is the one thing on this page that answers to the
                  controls rail beside it, so it belongs next to it rather than
                  below a states list that can run to seventeen tone swatches —
                  changing a control used to scroll the thing you were changing
                  off the screen. */}
              <div className="flex flex-col gap-6 pr-6">
                <PlaygroundCard
                  ref={previewRef}
                  component={demo.meta.title.replace(/\s+/g, '')}
                  playground={playground}
                  values={values}
                />
                <GeneratedCode demo={demo} values={values} />
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
              </div>
            </Panel>
            <Separator className="workbench-resize-handle" />
            {/* Pixel sizes, not percentages: on a full-bleed shell a 30% rail
                grows with the viewport for no reason. `preserve-pixel-size`
                keeps that width through window resizes (the stage stays
                relative, which the group requires of at least one panel). */}
            <Panel
              id="controls"
              panelRef={controlsRef}
              defaultSize={310}
              minSize={240}
              maxSize={520}
              collapsible
              collapsedSize={0}
              groupResizeBehavior="preserve-pixel-size"
              onResize={(size) => {
                const collapsed = size.inPixels === 0;
                if (collapsed !== controlsCollapsed) setCollapsed(collapsed);
              }}
            >
              <div className={cn('flex h-full flex-col pl-6', controlsCollapsed && 'hidden')}>
                <div className="flex items-center justify-between pb-2.5">
                  <span className="font-mono text-11/13 tracking-wider uppercase tracking-widest text-gray-9">
                    CONTROLS
                  </span>
                  <button
                    type="button"
                    onClick={() => setValues(initialValues(playground.controls))}
                    className="font-sans text-11/13 tracking-wider font-500 text-indigo-9 hover:underline"
                  >
                    Reset
                  </button>
                </div>
                <ControlsPanel
                  controls={playground.controls}
                  values={values}
                  onChange={(key, value) => setValues((v) => ({ ...v, [key]: value }))}
                />
                <p className="mt-3 font-sans text-11/13 tracking-wider text-gray-9">
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

      <div className={tab === 'docs' ? '' : 'hidden'}>
        <DocsPanel demo={demo} />
      </div>
      <div className={tab === 'impl' ? '' : 'hidden'}>
        <ImplTab demo={demo} sources={implSources} />
      </div>
      <div className={tab === 'demo' ? '' : 'hidden'}>
        <DemoTab demo={demo} source={source} />
      </div>
      <div className={tab === 'a11y' ? '' : 'hidden'}>
        {playground && <A11yTab runAudit={runAudit} />}
      </div>
    </div>
  );
}
