import type { ReactNode } from 'react';

export function ToggleGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="mr-0.5 text-xs uppercase tracking-wider text-dim">{label}</span>
      {children}
    </div>
  );
}
