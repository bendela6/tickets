export function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex-1 rounded-md border-1 border-gray-6 bg-gray-3 px-2 py-2 text-center">
      <div className="font-mono text-16 font-medium text-gray-12">{value}</div>
      <div className="text-10 uppercase tracking-wider text-gray-9">{label}</div>
    </div>
  );
}
