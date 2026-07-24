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
    <div className="flex flex-col gap-2.5">
      {Object.entries(controls).map(([key, def]) => (
        <div
          key={key}
          className="grid grid-cols-[96px_1fr] items-center gap-2.5 border-b border-hairline py-2.5"
        >
          <label htmlFor={key} className="font-mono text-label uppercase tracking-(--tracking-caps) text-ink-3">
            {def.label ?? key}
          </label>
          {def.kind === 'select' && (
            <select
              id={key}
              className={inputClasses}
              value={(values[key] as string | undefined) ?? ''}
              onChange={(e) => onChange(key, e.target.value === '' ? undefined : e.target.value)}
              aria-label={def.label ?? key}
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
              id={key}
              type="checkbox"
              className="size-4 accent-(--color-accent)"
              checked={values[key] as boolean}
              onChange={(e) => onChange(key, e.target.checked)}
              aria-label={def.label ?? key}
            />
          )}
          {def.kind === 'text' && (
            <input
              id={key}
              type="text"
              className={inputClasses}
              placeholder={def.placeholder}
              value={values[key] as string}
              onChange={(e) => onChange(key, e.target.value)}
              aria-label={def.label ?? key}
            />
          )}
          {def.kind === 'number' && (
            <input
              id={key}
              type="number"
              className={`${inputClasses} w-20`}
              min={def.min}
              max={def.max}
              step={def.step}
              value={values[key] as number}
              onChange={(e) => onChange(key, e.target.value === '' ? def.initial : Number(e.target.value))}
              aria-label={def.label ?? key}
            />
          )}
        </div>
      ))}
    </div>
  );
}
