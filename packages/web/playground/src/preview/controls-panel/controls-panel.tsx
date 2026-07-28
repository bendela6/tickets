import type { AnyControlDef } from '@tickets/ui';

const inputClasses =
  'h-7 rounded-md border border-gray-7 bg-surface-raised px-2 font-sans text-13/19 text-gray-12 focus:outline-none focus:ring-2 focus:ring-indigo-3';

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
          className="grid grid-cols-[96px_1fr] items-center gap-2.5 border-b border-gray-6 py-2.5"
        >
          <label htmlFor={key} className="font-mono text-11/13 tracking-wider uppercase tracking-widest text-gray-9">
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
              value={(values[key] as number | undefined) ?? ''}
              placeholder={def.allowNone ? 'unset' : undefined}
              onChange={(e) =>
                onChange(
                  key,
                  e.target.value === ''
                    ? // An allowNone control empties to undefined so the demo can
                      // show the component's own default; otherwise emptying the
                      // box falls back to the initial rather than to NaN.
                      def.allowNone
                      ? undefined
                      : def.initial
                    : Number(e.target.value),
                )
              }
              aria-label={def.label ?? key}
            />
          )}
        </div>
      ))}
    </div>
  );
}
