import type { ReactNode } from 'react';

export function ToggleGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <span className="mr-4 text-11 uppercase tracking-wider text-gray-11">{label}</span>
      {children}
    </div>
  );
}
