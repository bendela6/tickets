export function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex-1 rounded-6 border-1 border-gray-6 bg-gray-3 px-8 py-8 text-center">
      <div className="font-mono text-16 font-500 text-gray-12">{value}</div>
      <div className="text-10 uppercase tracking-wider text-gray-11">{label}</div>
    </div>
  );
}
