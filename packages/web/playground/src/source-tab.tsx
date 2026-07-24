import { useEffect, useState } from 'react';
import type { CollectedDemo } from '@tickets/ui/gallery';
import { getHighlighter } from './highlight';

type LiveDemo = Extract<CollectedDemo, { slug: string }>;

const COPY_STATE_RESET_MS = 1500;

// Source tab (design: playground-workbench.dc.html 1d) — the raw demo file,
// threaded down from the route's `?raw` glob (GalleryShell -> ComponentPage
// -> here). Demos without a matching glob entry (e.g. collected from a
// package that didn't wire `sources`) get a muted note instead of a block.
export function SourceTab({ demo, source }: { demo: LiveDemo; source?: string }) {
  const [html, setHtml] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    if (source === undefined) return;
    let cancelled = false;
    void getHighlighter().then((highlight) => {
      if (!cancelled) setHtml(highlight(source));
    });
    return () => {
      cancelled = true;
    };
  }, [source]);

  useEffect(() => {
    if (copyState === 'idle') return;
    const timer = window.setTimeout(() => setCopyState('idle'), COPY_STATE_RESET_MS);
    return () => window.clearTimeout(timer);
  }, [copyState]);

  async function handleCopy() {
    if (source === undefined) return;
    try {
      await navigator.clipboard.writeText(source);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  }

  if (source === undefined) {
    return <p className="font-sans text-meta text-ink-3">Source unavailable for this demo.</p>;
  }

  const filename = demo.path.split('/').pop()!.toUpperCase();
  const lineCount = source.split('\n').length;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-label uppercase tracking-(--tracking-caps) text-ink-3">
          {filename}
        </span>
        <span className="font-mono text-meta text-ink-3">{lineCount} lines</span>
      </div>
      <div className="pg-code-block pg-code-block--numbered rounded-card p-5 font-mono text-ui">
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="pg-code-copy absolute top-2.5 right-2.5 inline-flex h-[26px] items-center gap-1.5 rounded-ctrl border border-transparent px-2.5 font-sans text-label font-medium"
        >
          {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : '⧉ Copy'}
        </button>
        {html !== null ? <div dangerouslySetInnerHTML={{ __html: html }} /> : <pre>{source}</pre>}
      </div>
    </div>
  );
}
