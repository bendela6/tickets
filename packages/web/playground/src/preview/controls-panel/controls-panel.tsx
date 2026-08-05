import { Combobox, FieldLabel, Input, NumberInput, Switch, type AnyControlDef, type Option } from '@tickets/ui';

// An `allowNone` select needs a pickable way back to "no value". Combobox has
// no clear affordance by design — a single select is changed by picking, not
// emptied — so the escape hatch has to be an option like any other. The empty
// string is safe as its value because a control's own options are prop names,
// never blank.
const UNSET = '';

// One labeled row per control, built from the library's own primitives. This
// panel used native elements until the components moved into @tickets/ui;
// hand-rolled controls in the tool that documents the controls was the odd
// thing about it.
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
    <div className="flex flex-col gap-10">
      {Object.entries(controls).map(([key, def]) => {
        const label = def.label ?? key;

        // A toggle carries its own label in this library, so a second one in
        // the left column would say everything twice. Boolean rows give up the
        // two-column grid and let the Switch label the row.
        if (def.kind === 'boolean') {
          return (
            <div key={key} className="border-b-1 border-gray-6 py-10">
              <Switch
                id={key}
                label={label}
                value={values[key] as boolean}
                onChange={(next) => onChange(key, next)}
              />
            </div>
          );
        }

        return (
          <div
            key={key}
            className="grid grid-cols-[96px_1fr] items-center gap-10 border-b-1 border-gray-6 py-10"
          >
            <FieldLabel
              htmlFor={key}
              className="font-mono text-11/13 uppercase tracking-widest text-gray-9"
            >
              {label}
            </FieldLabel>

            {def.kind === 'select' && (
              <Combobox
                id={key}
                // A control's option set is short and fixed — tone, size,
                // variant — so a search box would be one keystroke of noise
                // between opening the list and reaching the option.
                searchable={false}
                options={[
                  ...(def.allowNone ? [{ value: UNSET, label: '(unset)' }] : []),
                  ...def.options.map((option): Option => ({ value: option, label: option })),
                ]}
                value={(values[key] as string | undefined) ?? UNSET}
                onChange={(picked) => onChange(key, picked === UNSET ? undefined : (picked ?? undefined))}
              />
            )}

            {def.kind === 'text' && (
              <Input
                id={key}
                placeholder={def.placeholder}
                value={values[key] as string}
                onChange={(next) => onChange(key, next)}
              />
            )}

            {def.kind === 'number' && (
              <NumberInput
                id={key}
                className="w-80"
                min={def.min}
                max={def.max}
                step={def.step}
                value={(values[key] as number | undefined) ?? null}
                placeholder={def.allowNone ? 'unset' : undefined}
                // Emptying an allowNone control returns undefined so the demo
                // shows the component's own default; without allowNone it falls
                // back to the initial rather than to NaN.
                onChange={(next) =>
                  onChange(key, next ?? (def.allowNone ? undefined : def.initial))
                }
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
