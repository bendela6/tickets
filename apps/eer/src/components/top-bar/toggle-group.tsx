import type { ReactNode } from 'react';

export function ToggleGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="mr-0.5 text-[0.68rem] uppercase tracking-[0.05em] text-dim">{label}</span>
      {children}
    </div>
  );
}
