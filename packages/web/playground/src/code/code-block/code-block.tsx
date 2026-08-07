import { useEffect, useState } from 'react';
import { cn, CopyButton } from '@tickets/ui';
import { getHighlighter } from '../highlight';

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

  useEffect(() => {
    let cancelled = false;
    void getHighlighter().then((highlight) => {
      if (!cancelled) setHtml(highlight(code));
    });
    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <div
      className={cn(
        'pg-code-block rounded-8 p-20 font-mono text-13/19',
        numbered && 'pg-code-block--numbered',
        className,
      )}
    >
      {/* `pg-code-copy` still carries the on-dark colours this surface needs —
          the block is fixed-dark regardless of theme, so the library's default
          gray border would disappear into it. Everything else, including the
          idle/copied/failed timer this file used to run itself, is CopyButton's. */}
      <CopyButton
        value={code}
        failedLabel="Copy failed"
        className="pg-code-copy absolute top-10 right-10"
      />
      {html !== null ? <div dangerouslySetInnerHTML={{ __html: html }} /> : <pre>{code}</pre>}
    </div>
  );
}
