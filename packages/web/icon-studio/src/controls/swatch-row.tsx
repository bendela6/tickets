import { contrast, verdict } from '../color';

const TONE: Record<string, string> = {
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
    <div className="grid grid-cols-[4.5rem_2.5rem_1.25rem_1fr_auto] items-center gap-2">
      <span className="font-mono text-12 text-gray-11">{label}</span>
      <input
        aria-label={label}
        type="color"
        value={base}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-10 rounded-md border-1 border-gray-6"
      />
      <span aria-hidden className="size-4 rounded-sm border-1 border-gray-6" style={{ background: derived }} />
      <span className="font-mono text-12 text-gray-12">{derived}</span>
      <span className={`font-mono text-11 ${TONE[verdict(ratio)]}`}>{ratio.toFixed(2)}:1</span>
    </div>
  );
}
