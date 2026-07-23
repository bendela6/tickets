import { useState, type ReactNode } from 'react';
import { DemoErrorCard, StateGrid } from './state-grid';
import { isDemoError, type CollectedDemo } from './types';

// Full gallery page: grouped nav + theme toggle + demo grids. `providers`
// wraps the demo area — web passes its Tooltip/Toast providers until P3
// moves those primitives into this package.
export function GalleryShell({
  demos,
  title,
  providers = (children) => children,
}: {
  demos: CollectedDemo[];
  title: string;
  providers?: (children: ReactNode) => ReactNode;
}) {
  const [, force] = useState(0);
  const nonErrorDemos = demos.filter((d): d is Extract<CollectedDemo, { slug: string }> => !isDemoError(d));
  const groups = [...new Set(nonErrorDemos.map((d) => d.meta.group))];

  function toggleTheme() {
    const root = document.documentElement;
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    force((n) => n + 1);
  }

  return (
    <div className="min-h-screen bg-app px-8 py-10 font-sans text-ink">
      <div className="mx-auto flex max-w-5xl flex-col gap-10">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="font-sans text-display font-semibold text-ink">{title}</h1>
            <p className="mt-1 font-sans text-meta text-ink-2">
              Instrument control library. Compare against docs/design/design-system.html.
            </p>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="h-9 rounded-ctrl border border-control bg-raised px-3.5 font-sans text-ui text-ink hover:bg-inset"
          >
            Toggle theme
          </button>
        </header>
        <nav className="flex flex-wrap gap-x-4 gap-y-1 font-sans text-meta text-ink-2">
          {groups.map((g) => (
            <span key={g} className="font-medium uppercase tracking-wider text-ink-3">
              {g}
            </span>
          ))}
        </nav>
        {providers(
          <div className="flex flex-col gap-10">
            {demos.map((d) =>
              isDemoError(d) ? (
                <DemoErrorCard key={d.path} path={d.path} error={d.error} />
              ) : (
                <StateGrid key={d.slug} demo={d} />
              ),
            )}
          </div>,
        )}
      </div>
    </div>
  );
}
