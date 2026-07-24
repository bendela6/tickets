import type { AnyControlDef } from '@tickets/ui/gallery';

const inputClasses =
  'h-7 rounded-ctrl border border-control bg-raised px-2 font-sans text-ui text-ink focus:outline-none focus:ring-2 focus:ring-accent-subtle';

// One labeled row per control. Native elements only — this panel must not
// depend on apps/web primitives (they move into this package in P3).
export function ControlsPanel({
  controls,
  values,
  onChange,
}: {
  controls: Record<string, AnyControlDef>;
  values: Record<string, unknown>;
  onChange: (key: string, value: string | number | boolean | undefined) => void;
}) {
  return (
    <div className="flex w-64 shrink-0 flex-col gap-2.5">
      {Object.entries(controls).map(([key, def]) => (
        <label key={key} className="flex items-center justify-between gap-3 font-sans text-meta text-ink-2">
          <span className="font-mono text-label uppercase tracking-(--tracking-label) text-ink-3">
            {def.label ?? key}
          </span>
          {def.kind === 'select' && (
            <select
              className={inputClasses}
              value={(values[key] as string | undefined) ?? ''}
              onChange={(e) => onChange(key, e.target.value === '' ? undefined : e.target.value)}
            >
              {def.allowNone && <option value="">(unset)</option>}
              {def.options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          )}
          {def.kind === 'boolean' && (
            <input
              type="checkbox"
              className="size-4 accent-(--color-accent)"
              checked={values[key] as boolean}
              onChange={(e) => onChange(key, e.target.checked)}
            />
          )}
          {def.kind === 'text' && (
            <input
              type="text"
              className={inputClasses}
              placeholder={def.placeholder}
              value={values[key] as string}
              onChange={(e) => onChange(key, e.target.value)}
            />
          )}
          {def.kind === 'number' && (
            <input
              type="number"
              className={`${inputClasses} w-20`}
              min={def.min}
              max={def.max}
              step={def.step}
              value={values[key] as number}
              onChange={(e) => onChange(key, e.target.value === '' ? def.initial : Number(e.target.value))}
            />
          )}
        </label>
      ))}
    </div>
  );
}
