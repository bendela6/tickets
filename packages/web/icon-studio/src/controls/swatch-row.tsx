import { contrast, verdict, type Verdict } from '../color';

const TONE: Record<Verdict, string> = {
  ok: 'text-green-11',
  min: 'text-orange-11',
  bad: 'text-pink-11',
};

export function SwatchRow({
  label, base, derived, ground, onChange,
}: {
  label: string;
  base: string;
  derived: string;
  ground: string;
  onChange: (hex: string) => void;
}) {
  const ratio = contrast(derived, ground);
  return (
    <div className="flex items-center gap-8">
      <span className="w-72 shrink-0 font-mono text-12 text-gray-11">{label}</span>
      <input
        aria-label={label}
        type="color"
        value={base}
        onChange={(e) => onChange(e.target.value)}
        className="h-28 w-40 shrink-0 rounded-6 border-1 border-gray-6"
      />
      <span aria-hidden className="mr-4 size-16 shrink-0 rounded-4 border-1 border-gray-6" style={{ background: derived }} />
      <span className="flex-1 font-mono text-12 text-gray-12">{derived}</span>
      <span className={`shrink-0 font-mono text-11 ${TONE[verdict(ratio)]}`}>{ratio.toFixed(2)}:1</span>
    </div>
  );
}
