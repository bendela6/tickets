import type { CollectedDemo } from '@tickets/ui';
import { CodeBlock } from './code-block';
import { fileName } from './resolve-impl';

type LiveDemo = Extract<CollectedDemo, { slug: string }>;

// The `.demo.tsx` file itself — how the states and the playground fixture on
// the Preview tab are wired up. (The component being demoed lives in the
// Implementation tab next door.) Threaded down from the route's eager `?raw`
// glob: GalleryShell -> ComponentPage -> here. Demos collected from a package
// that didn't wire `sources` get a muted note instead of a block.
export function DemoTab({ demo, source }: { demo: LiveDemo; source?: string }) {
  if (source === undefined) {
    return <p className="font-sans text-meta text-ink-3">Source unavailable for this demo.</p>;
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-label uppercase tracking-(--tracking-caps) text-ink-3">
          {fileName(demo.path).toUpperCase()}
        </span>
        <span className="font-mono text-meta text-ink-3">{source.split('\n').length} lines</span>
      </div>
      <CodeBlock code={source} numbered />
    </div>
  );
}
