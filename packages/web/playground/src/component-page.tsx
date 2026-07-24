import { useState } from 'react';
import { Group, Panel, Separator, type Layout } from 'react-resizable-panels';
import { cn } from '@tickets/ui/cn';
import { initialValues, type CollectedDemo } from '@tickets/ui/gallery';
import { ControlsPanel } from './controls-panel';
import { loadLayout, saveLayout } from './persisted-layout';
import { PlaygroundCard } from './playground-card';
import { PropsTable } from './props-table';
import { StateGrid } from './state-grid';

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

// Real component, not a stub: Code/Source render this until Task 5 wires
// generated code + raw source, A11y until Task 8 wires the audit.
function TabPending() {
  return <p className="font-sans text-meta text-ink-3">Coming in this build.</p>;
}

// One component's doc page (design: docs/design/pulls/playground-workbench.dc.html
// lines 103-188). Underline tab strip over Preview/Code/Source/A11y; Preview
// splits into a resizable stage (states + playground + props) and a controls
// rail. Non-active tabs stay mounted (`hidden`, not unmounted) so playground
// values survive switching away and back — verified by component-page.test.tsx.
export function ComponentPage({ demo, source }: { demo: LiveDemo; source?: string }) {
  // `source` is threaded through for the Code/Source tabs landing in Tasks 5/8.
  void source;
  const [tab, setTab] = useState<TabKey>('preview');
  const { playground } = demo;
  const [values, setValues] = useState<Record<string, unknown>>(() =>
    playground ? initialValues(playground.controls) : {},
  );
  const [defaultLayout] = useState<Layout | undefined>(() => loadLayout(WORKBENCH_LAYOUT_KEY));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-6 border-b border-hairline">
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

      <div className={tab === 'preview' ? '' : 'hidden'}>
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
                <StateGrid demo={demo} />
                <PlaygroundCard playground={playground} values={values} />
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
                  Unset props fall back to the component default and are omitted from generated code.
                </p>
              </div>
            </Panel>
          </Group>
        ) : (
          <StateGrid demo={demo} />
        )}
      </div>

      <div className={tab === 'code' ? '' : 'hidden'}>
        <TabPending />
      </div>
      <div className={tab === 'source' ? '' : 'hidden'}>
        <TabPending />
      </div>
      <div className={tab === 'a11y' ? '' : 'hidden'}>
        <TabPending />
      </div>
    </div>
  );
}
