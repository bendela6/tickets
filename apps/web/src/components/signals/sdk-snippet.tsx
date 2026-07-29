import { useEffect, useState } from 'react';
import { cn, CopyButton, Tabs } from '@tickets/ui';

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
 * toggle (React/Node/Browser) and a CopyButton.
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

  useEffect(() => {
    setActive(platform);
  }, [platform]);

  const code = snippetFor(active, dsn);

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <Tabs variant="pill" role="group"
          className="h-7"
          label="SDK platform"
          items={PLATFORMS.map((candidate) => ({ value: candidate, label: PLATFORM_LABELS[candidate] }))}
          value={active}
          onChange={(next) => setActive(next as SdkPlatform)}
        />
        <CopyButton value={code} failedLabel="Copy failed" className="shrink-0" />
      </div>
      <pre className="overflow-x-auto rounded-lg border border-gray-6 bg-surface-inset p-3 font-mono text-12 leading-relaxed text-gray-12">
        <code>{code}</code>
      </pre>
    </div>
  );
}
