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
    <div className="grid grid-cols-[6rem_1fr_3rem] items-center gap-2">
      <span className="font-mono text-12 text-gray-11">{label}</span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="text-right font-mono text-11 tabular-nums text-gray-12">
        {format ? format(value) : value}
      </span>
    </div>
  );
}
