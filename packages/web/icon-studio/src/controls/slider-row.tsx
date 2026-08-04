export function SliderRow({
  label, value, min, max, step = 1, format, onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-8">
      <span className="w-96 shrink-0 font-mono text-12 text-gray-11">{label}</span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="min-w-0 flex-1"
      />
      <span className="w-48 shrink-0 text-right font-mono text-11 tabular-nums text-gray-12">
        {format ? format(value) : value}
      </span>
    </div>
  );
}
