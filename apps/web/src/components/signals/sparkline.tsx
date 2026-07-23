import { cn } from '@tickets/ui/cn';

const BAR_COUNT = 14;
const MAX_HEIGHT_PX = 18;
const MIN_HEIGHT_PX = 2;

/**
 * 14-bar sparkline (docs/design/SigGallery.dc.html "14-DAY SPARKLINE").
 * Heights are normalized to the series max, with a minimum visible height
 * for zero counts so an empty day never fully disappears. The last bar
 * (today) carries the danger color when `hot`.
 */
export function Sparkline({
  counts,
  hot,
  className,
}: {
  counts: number[];
  hot?: boolean;
  className?: string;
}) {
  const recent = counts.slice(-BAR_COUNT);
  const bars = [...new Array(Math.max(0, BAR_COUNT - recent.length)).fill(0), ...recent];
  const max = Math.max(0, ...bars);

  return (
    <div
      role="img"
      aria-label="signal volume, last 14 days"
      className={cn('inline-flex h-[18px] items-end gap-0.5 px-0.5', className)}
    >
      {bars.map((count, i) => {
        const isLast = i === bars.length - 1;
        const height =
          max === 0 ? MIN_HEIGHT_PX : Math.max(MIN_HEIGHT_PX, Math.round((count / max) * MAX_HEIGHT_PX));
        return (
          <span
            key={i}
            data-testid="sparkline-bar"
            style={{ height }}
            className={cn('w-[5px] rounded-[1px]', isLast && hot ? 'bg-danger' : 'bg-control')}
          />
        );
      })}
    </div>
  );
}
