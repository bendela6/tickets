import { useEffect, useState } from 'react';
import { cn } from '@tickets/ui';
import { getHighlighter } from './highlight';

const COPY_STATE_RESET_MS = 1500;

// The fixed-dark syntax surface shared by every code view in the workbench
// (the Preview stage's generated snippet, the Demo tab, the Implementation
// tab). Highlighting resolves lazily, so the raw text renders first — no
// flash of nothing — and is swapped for the marked-up version when shiki
// lands. `numbered` adds the CSS-counter line gutter (see styles.css).
export function CodeBlock({
  code,
  numbered = false,
  className,
}: {
  code: string;
  numbered?: boolean;
  className?: string;
}) {
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

  return (
    <div
      className={cn(
        'pg-code-block rounded-card p-5 font-mono text-ui',
        numbered && 'pg-code-block--numbered',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => void handleCopy()}
        className="pg-code-copy absolute top-2.5 right-2.5 inline-flex h-6.5 items-center gap-1.5 rounded-ctrl border border-transparent px-2.5 font-sans text-label font-medium"
      >
        {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : '⧉ Copy'}
      </button>
      {html !== null ? <div dangerouslySetInnerHTML={{ __html: html }} /> : <pre>{code}</pre>}
    </div>
  );
}
