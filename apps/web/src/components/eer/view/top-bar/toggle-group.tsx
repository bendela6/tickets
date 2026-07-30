import type { ReactNode } from 'react';

export function ToggleGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="mr-1 text-11 uppercase tracking-wider text-gray-9">{label}</span>
      {children}
    </div>
  );
}
