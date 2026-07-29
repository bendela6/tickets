import { DEFAULT_VIEW, initialValues, type CollectedDemo } from '@tickets/ui';

type LiveDemo = Extract<CollectedDemo, { slug: string }>;

// A component whose demo declares `size: 'full'` needs the whole row to render
// honestly (Icon's 46-glyph registry, a message transcript). There is no
// column wide enough for it beside 800px of documentation, so it doesn't get
// one — its Preview tab is a click away via the entry's jump links.
export function fitsBesideDocs(demo: LiveDemo): boolean {
  return demo.meta.size !== 'full';
}

// The All view's right-hand preview: one live instance of the component at
// its default configuration. Prefers the playground (which is the same thing
// the Preview tab opens on) and falls back to the demo's first state for
// components that have no controls.
export function DemoPreview({ demo }: { demo: LiveDemo }) {
  const { playground } = demo;
  const node = playground
    ? playground.render(initialValues(playground.controls) as never)
    : demo.states[0]?.render(DEFAULT_VIEW);

  return (
    <div className="flex flex-col gap-2.5">
      <span className="font-mono text-11/13 tracking-wider uppercase tracking-widest text-gray-9">
        PREVIEW
      </span>
      <div className="flex min-h-32 items-center justify-center rounded-lg border-1 border-gray-6 bg-surface-raised p-7">
        {node}
      </div>
    </div>
  );
}
