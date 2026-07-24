import { cn } from '@tickets/ui/cn';
import { CopyButton } from '@tickets/ui/copy-button';

/**
 * DSN field (docs/design/SigGallery.dc.html "DSN FIELD — MACHINE TRUTH,
 * ALWAYS COPYABLE"): mono text truncated with ellipsis + a Copy button that
 * flips to "Copied" briefly after a successful clipboard write, or "Failed"
 * if the clipboard write rejects (permissions, insecure context, etc.) —
 * never an unhandled rejection.
 */
export function DsnField({ dsn, className }: { dsn: string; className?: string }) {
  return (
    <div
      role="group"
      aria-label="DSN"
      className={cn(
        'flex h-9 max-w-[520px] items-center gap-2.5 rounded-[8px] border border-hairline bg-inset py-0 pr-1.5 pl-3',
        className,
      )}
    >
      <span className="flex-1 truncate font-mono text-[12px] font-medium text-ink">{dsn}</span>
      <CopyButton value={dsn} className="shrink-0" />
    </div>
  );
}
