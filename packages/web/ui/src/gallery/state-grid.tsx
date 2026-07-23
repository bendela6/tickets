import { cn } from '../cn';
import type { CollectedDemo } from './types';

type LiveDemo = Extract<CollectedDemo, { slug: string }>;

// One component's demo: heading + a labeled cell per state. Cell ids are the
// screenshot/deep-link anchors (`#button--loading`).
export function StateGrid({ demo }: { demo: LiveDemo }) {
  return (
    <section id={demo.slug} className="flex flex-col gap-3">
      <h2 className="font-sans text-label font-medium uppercase tracking-wider text-ink-2">
        {demo.meta.title}
      </h2>
      <div className="flex flex-wrap items-start gap-4 rounded-card border border-hairline bg-raised p-4">
        {demo.states.map((state) => (
          <figure key={state.slug} id={state.slug} className="m-0 flex flex-col gap-1.5">
            <div className="flex items-start">{state.render()}</div>
            <figcaption className="font-mono text-label text-ink-3">{state.name}</figcaption>
          </figure>
        ))}
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
