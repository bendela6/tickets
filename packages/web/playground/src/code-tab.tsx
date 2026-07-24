import { useEffect, useState } from 'react';
import type { CollectedDemo } from '@tickets/ui/gallery';
import { generateSnippet } from './code-snippet';
import { getHighlighter } from './highlight';

type LiveDemo = Extract<CollectedDemo, { slug: string }>;

const COPY_STATE_RESET_MS = 1500;

// Code tab (design: playground-workbench.dc.html 1c). Re-generates the JSX
// snippet from the live playground `values` on every render — no memoing,
// this is cheap string work — and highlights it lazily via getHighlighter().
// Before the highlighter resolves we still show the raw text (no flash of
// nothing), just unstyled.
export function CodeTab({ demo, values }: { demo: LiveDemo; values: Record<string, unknown> }) {
  const { playground } = demo;
  const component = demo.meta.title.replace(/\s+/g, '');
  const { code, omitted } = playground
    ? generateSnippet(component, playground.controls, values)
    : { code: '', omitted: [] as string[] };

  const [html, setHtml] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    let cancelled = false;
    void getHighlighter().then((highlight) => {
      if (!cancelled) setHtml(highlight(code));
    });
    return () => {
      cancelled = true;
    };
  }, [code]);

  useEffect(() => {
    if (copyState === 'idle') return;
    const timer = window.setTimeout(() => setCopyState('idle'), COPY_STATE_RESET_MS);
    return () => window.clearTimeout(timer);
  }, [copyState]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  }

  if (!playground) {
    return (
      <p className="font-sans text-meta text-ink-3">This component has no playground controls.</p>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="font-mono text-label uppercase tracking-(--tracking-caps) text-ink-3">
        GENERATED FROM CURRENT CONTROLS
      </div>
      <div className="pg-code-block rounded-card p-5 font-mono text-ui">
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="pg-code-copy absolute top-2.5 right-2.5 inline-flex h-[26px] items-center gap-1.5 rounded-ctrl border border-transparent px-2.5 font-sans text-label font-medium"
        >
          {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : '⧉ Copy'}
        </button>
        {html !== null ? <div dangerouslySetInnerHTML={{ __html: html }} /> : <pre>{code}</pre>}
      </div>
      {omitted.length > 0 && (
        <p className="font-mono text-meta text-ink-3">
          {omitted.map((key) => `${key} unset → omitted`).join(' · ')}
        </p>
      )}
    </div>
  );
}
