import { useEffect, useState, type ReactNode } from 'react';
import { PlaygroundCard } from './playground-card';
import { DemoErrorCard, StateGrid } from './state-grid';
import { isDemoError, type CollectedDemo } from './types';

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
}: {
  demos: CollectedDemo[];
  title: string;
  providers?: (children: ReactNode) => ReactNode;
}) {
  const live = demos.filter((d): d is LiveDemo => !isDemoError(d));
  const errors = demos.filter(isDemoError);
  const [rawHash, setRawHash] = useState(() => window.location.hash.replace(/^#/, ''));

  useEffect(() => {
    const onHash = () => setRawHash(window.location.hash.replace(/^#/, ''));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
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

  return (
    <div className="flex min-h-screen bg-app font-sans text-ink">
      <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col gap-4 overflow-y-auto border-r border-hairline bg-raised px-4 py-6">
        <a
          href="#"
          onClick={() => setRawHash('')}
          className={`rounded-ctrl px-2 py-1 text-ui ${selected === null ? 'bg-accent-subtle text-accent' : 'text-ink-2 hover:text-ink'}`}
        >
          All
        </a>
        {groups.map((g) => (
          <div key={g} className="flex flex-col gap-0.5">
            <span className="px-2 font-mono text-label uppercase tracking-(--tracking-label) text-ink-3">{g}</span>
            {live
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
      <main className="flex-1 px-8 py-10">
        <div className="mx-auto flex max-w-5xl flex-col gap-10">
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
              {shown.map((d) => (
                <div key={d.slug} className="flex flex-col gap-6">
                  <StateGrid demo={d} />
                  {selected === d.slug && d.playground && <PlaygroundCard playground={d.playground} />}
                </div>
              ))}
              {selected === null && errors.map((e) => <DemoErrorCard key={e.path} path={e.path} error={e.error} />)}
            </div>,
          )}
        </div>
      </main>
    </div>
  );
}
