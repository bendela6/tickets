export function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex-1 rounded-md border border-gray-600 bg-gray-800 px-2 py-1.5 text-center">
      <div className="font-mono text-lg font-medium text-gray-50">{value}</div>
      <div className="text-2xs uppercase tracking-wider text-gray-400">{label}</div>
    </div>
  );
}
