import { cn, Meter } from '@tickets/ui';

// Agent runs cost real money and the UI must never hide that (screen 10): spend
// so far, always visible in the session header. With a budget cap it shows
// spend / cap plus a thin fill that turns danger-coloured once the cap is hit.
export function CostMeter({
  costUsd,
  capUsd,
  className,
}: {
  costUsd: number;
  capUsd?: number | null;
  className?: string;
}) {
  const capped = capUsd != null && capUsd > 0;
  const over = capped && costUsd >= capUsd;
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-2 rounded-md border border-gray-6 bg-surface-raised px-2',
        className,
      )}
      title={capped ? `spend $${costUsd.toFixed(4)} of $${capUsd.toFixed(2)} cap` : 'spend so far'}
    >
      <span className={cn('font-mono text-meta', over ? 'text-red-9' : 'text-gray-12')}>
        ${costUsd.toFixed(2)}
      </span>
      {capped ? (
        <>
          <span className="font-mono text-meta text-gray-9">/ ${capUsd.toFixed(2)}</span>
          <Meter value={costUsd} max={capUsd} dangerAt={capUsd} />
        </>
      ) : null}
    </span>
  );
}
