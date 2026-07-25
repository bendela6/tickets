import { useEffect, useState, type ReactNode } from 'react';
import { isDemoError, type CollectedDemo } from '@tickets/ui/gallery';
import { ComponentPage } from './component-page';
import { DocsPanel } from './docs-panel';
import type { ImplSources } from './impl-tab';
import { DemoErrorCard, StateGrid } from './state-grid';
import { CommandPalette } from './command-palette';

type LiveDemo = Extract<CollectedDemo, { slug: string }>;

function slugFromHash(rawHash: string, live: LiveDemo[]): string | null {
  if (!rawHash) return null;
  const slug = rawHash.includes('--') ? rawHash.split('--')[0]! : rawHash;
  return live.some((d) => d.slug === slug) ? slug : null;
}

export function GalleryShell({
  demos,
  title,
  providers = (children) => children,
  sources,
  implSources,
}: {
  demos: CollectedDemo[];
  title: string;
  providers?: (children: ReactNode) => ReactNode;
  /** Eager `?raw` demo-file sources, keyed by `demo.path` — the Demo tab. */
  sources?: Record<string, string>;
  /** Lazy `?raw` component-file loaders, keyed by path — the Implementation tab. */
  implSources?: ImplSources;
}) {
  const live = demos.filter((d): d is LiveDemo => !isDemoError(d));
  const errors = demos.filter(isDemoError);
  const [rawHash, setRawHash] = useState(() => window.location.hash.replace(/^#/, ''));
  const [filterQuery, setFilterQuery] = useState('');
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const onHash = () => setRawHash(window.location.hash.replace(/^#/, ''));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Global keydown listener for ⌘K / Ctrl+K
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const selected = slugFromHash(rawHash, live);

  // Spec: "#slug--state selects the component AND scrolls to the state". The
  // state cell only exists after the selection render, so scroll post-render.
  useEffect(() => {
    if (rawHash.includes('--')) document.getElementById(rawHash)?.scrollIntoView();
  }, [rawHash]);

  function toggleTheme() {
    const root = document.documentElement;
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  }

  const groups = [...new Set(live.map((d) => d.meta.group))];
  const shown = selected ? live.filter((d) => d.slug === selected) : live;

  // Filter logic
  const filteredLive = live.filter((d) =>
    d.meta.title.toLowerCase().includes(filterQuery.toLowerCase())
  );
  const filteredGroups = groups.filter((g) =>
    filteredLive.some((d) => d.meta.group === g)
  );

  return (
    <div className="flex min-h-screen bg-app font-sans text-ink">
      <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col gap-4 overflow-y-auto border-r border-hairline bg-raised px-4 py-6">
        <div className="flex items-center gap-1.5 h-7.5 px-1.5 pl-2.5 rounded-card border border-hairline bg-inset">
          <input
            type="text"
            placeholder="Filter components…"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="flex-1 bg-transparent text-ui text-ink-2 placeholder:text-ink-3 outline-none"
          />
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="h-4.5 px-1.25 border border-control bg-raised text-label text-ink-3 rounded-xs hover:text-ink-2"
          >
            ⌘K
          </button>
        </div>
        <a
          href="#"
          onClick={() => setRawHash('')}
          className={`rounded-ctrl px-2 py-1 text-ui ${selected === null ? 'bg-accent-subtle text-accent' : 'text-ink-2 hover:text-ink'}`}
        >
          All
        </a>
        {filteredGroups.map((g) => (
          <div key={g} className="flex flex-col gap-0.5">
            <span className="px-2 font-mono text-label uppercase tracking-(--tracking-label) text-ink-3">{g}</span>
            {filteredLive
              .filter((d) => d.meta.group === g)
              .map((d) => (
                <a
                  key={d.slug}
                  href={`#${d.slug}`}
                  className={`rounded-ctrl px-2 py-1 text-ui ${selected === d.slug ? 'bg-accent-subtle text-accent' : 'text-ink-2 hover:text-ink'}`}
                >
                  {d.meta.title}
                </a>
              ))}
          </div>
        ))}
      </aside>
      {/* min-w-0 lets the workbench's overflowing children (code blocks, wide
          state grids) scroll inside the main column instead of stretching the
          flex row and pushing the sidebar off-screen. */}
      <main className="min-w-0 flex-1 px-8 py-10">
        <div className="flex w-full flex-col gap-10">
          <header className="flex items-center justify-between">
            <div>
              <h1 className="text-display font-semibold text-ink">{title}</h1>
              <p className="mt-1 text-meta text-ink-2">
                Instrument control library. Compare against docs/design/design-system.html.
              </p>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              className="h-9 rounded-ctrl border border-control bg-raised px-3.5 text-ui text-ink hover:bg-inset"
            >
              Toggle theme
            </button>
          </header>
          {providers(
            <div className="flex flex-col gap-10">
              {shown.map((d) =>
                selected === d.slug ? (
                  <ComponentPage
                    key={d.slug}
                    demo={d}
                    source={sources?.[d.path]}
                    implSources={implSources}
                  />
                ) : (
                  // The All view is the whole library read end to end: states
                  // first, then the same docs the component's own Docs tab
                  // shows. The rail note is dropped — there's no rail here.
                  <div key={d.slug} className="flex flex-col">
                    <StateGrid demo={d} />
                    {d.playground && <DocsPanel demo={d} railNote={false} />}
                  </div>
                ),
              )}
              {selected === null && errors.map((e) => <DemoErrorCard key={e.path} path={e.path} error={e.error} />)}
            </div>,
          )}
        </div>
      </main>
      <CommandPalette demos={live} open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
