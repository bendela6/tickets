import { useEffect, useState } from 'react';
import { Button } from '../../ui/button';
import { cn } from '../../ui/cn';

const COPIED_RESET_MS = 1500;

/**
 * DSN field (docs/design/SigGallery.dc.html "DSN FIELD — MACHINE TRUTH,
 * ALWAYS COPYABLE"): mono text truncated with ellipsis + a Copy button that
 * flips to "Copied" briefly after a successful clipboard write.
 */
export function DsnField({ dsn, className }: { dsn: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = window.setTimeout(() => setCopied(false), COPIED_RESET_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function handleCopy() {
    await navigator.clipboard.writeText(dsn);
    setCopied(true);
  }

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
      <Button
        variant="secondary"
        size="compact"
        onClick={() => void handleCopy()}
        className="h-[26px] shrink-0 px-2.5 text-[11px]"
      >
        {copied ? 'Copied' : '⧉ Copy'}
      </Button>
    </div>
  );
}
