import type { CollectedDemo } from '@tickets/ui/gallery';

type LiveDemo = Extract<CollectedDemo, { slug: string }>;

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
        <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
          {demo.states.map((state) => (
            <figure
              key={state.slug}
              id={state.slug}
              className="m-0 flex flex-col items-center gap-3 rounded-card border border-hairline bg-raised px-2.5 pb-3 pt-5"
            >
              <div className="flex items-center">{state.render()}</div>
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
