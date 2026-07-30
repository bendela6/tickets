export function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex-1 rounded-md border border-gray-6 bg-gray-3 px-2 py-2 text-center">
      <div className="font-mono text-lg font-medium text-gray-12">{value}</div>
      <div className="text-2xs uppercase tracking-wider text-gray-9">{label}</div>
    </div>
  );
}
