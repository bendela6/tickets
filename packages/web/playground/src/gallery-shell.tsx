import { useEffect, useState, type ReactNode } from 'react';
import { isDemoError, type CollectedDemo } from '@tickets/ui/gallery';
import { ComponentPage } from './component-page';
import { DemoPreview, fitsBesideDocs } from './demo-preview';
import { DocsPanel, DOCS_MEASURE } from './docs-panel';
import type { ImplSources } from './impl-tab';
import { DemoErrorCard } from './state-grid';
import { CommandPalette } from './command-palette';

type LiveDemo = Extract<CollectedDemo, { slug: string }>;

// Tabs a docs entry can deep-link into. `::` can't occur in a kebab slug or a
// state anchor, so it never collides with the `#slug--state` form.
const TAB_SEPARATOR = '::';
const JUMP_TABS = [
  { tab: 'preview', label: 'Preview' },
  { tab: 'impl', label: 'Implementation' },
  { tab: 'demo', label: 'Demo' },
] as const;

// `#pill` · `#pill--solid` (state anchor) · `#pill::impl` (tab)
export function parseHash(
  rawHash: string,
  live: LiveDemo[],
): { slug: string | null; tab: string | null } {
  if (!rawHash) return { slug: null, tab: null };
  const [anchor = '', tab] = rawHash.split(TAB_SEPARATOR);
  const slug = anchor.includes('--') ? anchor.split('--')[0]! : anchor;
  if (!live.some((d) => d.slug === slug)) return { slug: null, tab: null };
  return { slug, tab: tab ?? null };
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

  const { slug: selected, tab: selectedTab } = parseHash(rawHash, live);

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
                    initialTab={selectedTab}
                  />
                ) : (
                  // The All view is the library's documentation, read end to
                  // end — docs only, no state grids; the states live on each
                  // component's own Preview tab. The rail note is dropped
                  // because there is no controls rail on this screen.
                  // The rule runs the full width of the column while the
                  // documentation keeps its own measure, so it reads as a
                  // divider between entries rather than an underline on one.
                  <section
                    key={d.slug}
                    id={d.slug}
                    className="flex flex-col border-t-2 border-control pt-10 first:border-t-0 first:pt-0"
                  >
                    <div className="flex items-start gap-8">
                      <div className={`flex flex-col gap-4 ${DOCS_MEASURE}`}>
                        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                          <h2 className="font-sans text-heading font-semibold text-ink">
                            {d.meta.title}
                          </h2>
                          <div className="flex items-center gap-4">
                            {JUMP_TABS.map(({ tab, label }) => (
                              <a
                                key={tab}
                                href={`#${d.slug}${TAB_SEPARATOR}${tab}`}
                                className="font-sans text-meta font-medium text-accent hover:underline"
                              >
                                {label}
                              </a>
                            ))}
                          </div>
                        </div>
                        <DocsPanel demo={d} railNote={false} />
                      </div>
                      {/* Only where there's room for it: the docs hold 800px,
                          so the preview waits for a viewport that leaves a
                          usable column beside them, and sticks while a long
                          entry scrolls past. */}
                      {fitsBesideDocs(d) && (
                        <div className="sticky top-8 hidden min-w-0 flex-1 2xl:block">
                          <DemoPreview demo={d} />
                        </div>
                      )}
                    </div>
                  </section>
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
