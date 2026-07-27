import type { ReactNode } from 'react';

export function ThemeSplit({ render }: { render: () => ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-3.5">
      <div
        className="rounded-card border border-hairline bg-app p-4"
        data-theme="light"
      >
        <div className="font-mono text-label text-ink-3 mb-3">light</div>
        {render()}
      </div>
      <div
        className="rounded-card border border-hairline bg-app p-4"
        data-theme="dark"
      >
        <div className="font-mono text-label text-ink-3 mb-3">dark</div>
        {render()}
      </div>
    </div>
  );
}
