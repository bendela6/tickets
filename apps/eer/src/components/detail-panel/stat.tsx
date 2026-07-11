export function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex-1 rounded-md border border-border bg-surface-2 px-2 py-1.5 text-center">
      <div className="font-mono text-[1.05rem] font-medium text-ink">{value}</div>
      <div className="text-[0.6rem] uppercase tracking-[0.05em] text-dim">{label}</div>
    </div>
  );
}
