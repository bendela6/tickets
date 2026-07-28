import { useEffect, useState, type ReactNode } from 'react';
import { isDemoError, type CollectedDemo } from '@tickets/ui';
import { ComponentPage } from '../../page/component-page';
import { DemoPreview, fitsBesideDocs } from '../../preview/demo-preview';
import { DocsPanel, DOCS_COLUMN } from '../../page/tabs/docs-panel';
import type { ImplSources } from '../../page/tabs/impl-tab';
import { useHashAnchor, useHashNavigation, type GalleryNavigation } from '../navigation';
import { Sidebar } from '../sidebar';
import { DemoErrorCard } from '../../preview/state-grid';
import { CommandPalette } from '../command-palette';

type LiveDemo = Extract<CollectedDemo, { slug: string }>;

const JUMP_TABS = [
  { tab: 'preview', label: 'Preview' },
  { tab: 'impl', label: 'Implementation' },
  { tab: 'demo', label: 'Demo' },
] as const;

export function GalleryShell({
  demos,
  title,
  providers = (children) => children,
  sources,
  implSources,
  navigation,
}: {
  demos: CollectedDemo[];
  title: string;
  providers?: (children: ReactNode) => ReactNode;
  /** Eager `?raw` demo-file sources, keyed by `demo.path` — the Demo tab. */
  sources?: Record<string, string>;
  /** Lazy `?raw` component-file loaders, keyed by path — the Implementation tab. */
  implSources?: ImplSources;
  /**
   * How this host moves between components and tabs. Defaults to the hash
   * scheme, which needs no router — apps/web passes a router-backed one so
   * the gallery gets real `/gallery/:slug/:tab` URLs.
   */
  navigation?: GalleryNavigation;
}) {
  const live = demos.filter((d): d is LiveDemo => !isDemoError(d));
  const errors = demos.filter(isDemoError);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Always called (hooks can't be conditional); ignored when the host supplies
  // its own navigation.
  const hashNavigation = useHashNavigation();
  const nav = navigation ?? hashNavigation;
  const anchor = useHashAnchor();

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

  // The location names a slug; whether it's a real one is ours to say, so an
  // unknown component falls back to All rather than rendering nothing.
  const selected = live.some((d) => d.slug === nav.slug) ? nav.slug : null;
  const selectedTab = selected ? nav.tab : null;

  // "#slug--state selects the component AND scrolls to the state" — the
  // fragment keeps doing that under either navigation scheme. The state cell
  // only exists after the selection render, so scroll post-render.
  useEffect(() => {
    if (anchor?.includes('--')) document.getElementById(anchor)?.scrollIntoView();
  }, [anchor]);

  function toggleTheme() {
    const root = document.documentElement;
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  }

  const shown = selected ? live.filter((d) => d.slug === selected) : live;

  return (
    <div className="flex min-h-screen bg-gray-1 font-sans text-gray-12">
      <Sidebar
        demos={live}
        selected={selected}
        linkProps={nav.linkProps}
        onOpenPalette={() => setPaletteOpen(true)}
      />
      {/* min-w-0 lets the workbench's overflowing children (code blocks, wide
          state grids) scroll inside the main column instead of stretching the
          flex row and pushing the sidebar off-screen. */}
      <main className="min-w-0 flex-1 px-8 py-10">
        <div className="flex w-full flex-col gap-10">
          <header className="flex items-center justify-between">
            <div>
              <h1 className="text-display font-600 text-gray-12">{title}</h1>
              <p className="mt-1 text-meta text-gray-11">
                Instrument control library. Compare against docs/design/design-system.html.
              </p>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              className="h-9 rounded-md border border-gray-7 bg-surface-raised px-3.5 text-ui text-gray-12 hover:bg-surface-inset"
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
                    className="pg-docs-entry flex flex-col border-t-2 border-gray-7 pt-10 pb-16 first:border-t-0 first:pt-0"
                  >
                    <div className="flex items-start gap-8">
                      <div className={`flex flex-col gap-4 ${DOCS_COLUMN}`}>
                        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                          <h2 className="font-sans text-heading font-600 text-gray-12">
                            {d.meta.title}
                          </h2>
                          <div className="flex items-center gap-4">
                            {JUMP_TABS.map(({ tab, label }) => (
                              <a
                                key={tab}
                                {...nav.linkProps({ slug: d.slug, tab })}
                                className="font-sans text-meta font-500 text-indigo-9 hover:underline"
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
                        <div className="sticky top-8 hidden min-w-0 max-w-200 flex-1 2xl:block">
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
      <CommandPalette
        demos={live}
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onSelect={(slug) => nav.navigate({ slug })}
      />
    </div>
  );
}
