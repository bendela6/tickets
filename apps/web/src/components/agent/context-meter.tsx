import { cn, Meter } from '@tickets/ui';
import { formatTokens } from './agent-models';

// Context-window fill + cumulative output tokens, shown beside the CostMeter in
// the agent session header. Absent until the first result arrives. Turns danger
// once the context is ≥90% of the model window.
export function ContextMeter({
  contextTokens,
  contextWindow,
  tokensOut,
  cacheReadTokens,
  className,
}: {
  contextTokens: number | null;
  contextWindow: number;
  tokensOut: number;
  cacheReadTokens?: number;
  className?: string;
}) {
  if (contextTokens == null) return null;
  const hot = contextTokens >= contextWindow * 0.9;
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-2 rounded-md border border-hairline bg-raised px-2',
        className,
      )}
      title={
        `context ${formatTokens(contextTokens)} of ${formatTokens(contextWindow)}` +
        (cacheReadTokens ? ` · ${formatTokens(cacheReadTokens)} cache read` : '')
      }
    >
      <span
        data-testid="context-fill"
        className={cn('font-mono text-meta', hot ? 'text-danger' : 'text-ink')}
      >
        <span aria-hidden="true">▣ </span>
        {formatTokens(contextTokens)} / {formatTokens(contextWindow)}
      </span>
      <Meter value={contextTokens} max={contextWindow} dangerAt={contextWindow * 0.9} />
      <span className="font-mono text-meta text-ink-3" title="output tokens generated">
        <span aria-hidden="true">↓ </span>
        {formatTokens(tokensOut)}
      </span>
    </span>
  );
}
