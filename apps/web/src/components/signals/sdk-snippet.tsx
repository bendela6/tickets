import { useEffect, useState } from 'react';
import { Button } from '../../ui/button';
import { cn } from '@tickets/ui/cn';
import { SegmentedControl } from '@tickets/ui/segmented-control';

const COPY_STATE_RESET_MS = 1500;

type CopyState = 'idle' | 'copied' | 'failed';

export type SdkPlatform = 'react' | 'node' | 'browser';

const PLATFORMS: SdkPlatform[] = ['react', 'node', 'browser'];

const PLATFORM_LABELS: Record<SdkPlatform, string> = {
  react: 'React',
  node: 'Node',
  browser: 'Browser',
};

function snippetFor(platform: SdkPlatform, dsn: string): string {
  switch (platform) {
    case 'react':
      return (
        `import { initSignals } from '@bendela6/signals-react';\n` +
        `initSignals({ dsn: '${dsn}', environment: import.meta.env.MODE });\n\n` +
        `// Wrap your app in <SignalsErrorBoundary> to catch render errors.`
      );
    case 'node':
      return (
        `import { initSignals } from '@bendela6/signals-node';\n` +
        `initSignals({ dsn: '${dsn}', registerProcessHandlers: true });`
      );
    case 'browser':
      return (
        `<script src="${window.location.origin}/signals-api/sdk.js"></script>\n` +
        `<script>Signals.initSignals({ dsn: '${dsn}' })</script>`
      );
  }
}

/**
 * Copy-paste SDK init snippet for a given DSN + platform, with a platform
 * toggle (React/Node/Browser) and a copy button — same copy-state pattern as
 * DsnField (idle → "Copied" / "Copy failed", resetting after a beat).
 */
export function SdkSnippet({
  dsn,
  platform,
  className,
}: {
  dsn: string;
  platform: SdkPlatform;
  className?: string;
}) {
  const [active, setActive] = useState<SdkPlatform>(platform);
  const [copyState, setCopyState] = useState<CopyState>('idle');

  useEffect(() => {
    setActive(platform);
  }, [platform]);

  useEffect(() => {
    if (copyState === 'idle') {
      return;
    }
    const timer = window.setTimeout(() => setCopyState('idle'), COPY_STATE_RESET_MS);
    return () => window.clearTimeout(timer);
  }, [copyState]);

  const code = snippetFor(active, dsn);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <SegmentedControl
          className="h-7"
          label="SDK platform"
          options={PLATFORMS.map((candidate) => ({ value: candidate, label: PLATFORM_LABELS[candidate] }))}
          value={active}
          onChange={(next) => setActive(next as SdkPlatform)}
        />
        <Button
          variant="secondary"
          size="compact"
          onClick={() => void handleCopy()}
          className="h-[26px] shrink-0 px-2.5 text-[11px]"
        >
          {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : '⧉ Copy'}
        </Button>
      </div>
      <pre className="overflow-x-auto rounded-[8px] border border-hairline bg-inset p-3 font-mono text-[12px] leading-relaxed text-ink">
        <code>{code}</code>
      </pre>
    </div>
  );
}
