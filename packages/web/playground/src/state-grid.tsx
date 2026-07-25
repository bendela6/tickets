import { runtimeStyle } from '@tickets/ui/runtime-style';
import type { CollectedDemo, DemoSize } from '@tickets/ui/gallery';

type LiveDemo = Extract<CollectedDemo, { slug: string }>;

// Minimum width of one state cell, per the demo's declared `meta.size`. The
// grid auto-fills at that width (see `.pg-state-grid` in styles.css), so a
// `sm` component gets many narrow columns and a `full` one gets a single
// row-wide cell — components stop being squeezed into a column that can't
// hold them. The value travels as a custom property because Tailwind can't
// scan a class name built at runtime.
export const CELL_MIN: Record<DemoSize, string> = {
  sm: '160px',
  md: '240px',
  lg: '360px',
  full: '100%',
};

// One component's demo: heading + a grid of per-state cards. Cell ids are the
// screenshot/deep-link anchors (`#button--loading`).
export function StateGrid({ demo }: { demo: LiveDemo }) {
  return (
    <section id={demo.slug} className="flex flex-col gap-3">
      <h2 className="font-sans text-label font-medium uppercase tracking-wider text-ink-2">
        {demo.meta.title}
      </h2>
      <div className="flex flex-col gap-2.5">
        <div className="font-mono text-label uppercase tracking-(--tracking-caps) text-ink-3">STATES</div>
        <div
          className="pg-state-grid gap-2.5"
          style={runtimeStyle({ '--demo-cell': CELL_MIN[demo.meta.size ?? 'md'] })}
        >
          {demo.states.map((state) => (
            <figure
              key={state.slug}
              id={state.slug}
              className="m-0 flex flex-col items-center gap-3 rounded-card border border-hairline bg-raised px-2.5 pb-3 pt-5"
            >
              <div className="flex min-w-0 max-w-full items-center">{state.render()}</div>
              <figcaption className="font-mono text-label text-ink-3">{state.name}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

export function DemoErrorCard({ path, error }: { path: string; error: string }) {
  return (
    <section className="rounded-card border border-danger bg-danger-subtle p-4 font-mono text-meta text-danger">
      {path}: {error}
    </section>
  );
}
