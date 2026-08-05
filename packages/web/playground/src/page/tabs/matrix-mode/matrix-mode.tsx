import {
  Combobox,
  FieldLabel,
  type AnyControlDef,
  type ControlValues,
  type PlaygroundDef,
} from '@tickets/ui';

// One matrix axis. The label sits outside the trigger rather than inside it:
// the Combobox trigger is already a bordered box with its own chevron, so
// nesting "rows:" inside would be a box within a box.
function AxisPicker({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex items-center gap-8">
      {/* No trailing colon: the accessible name is what tests and screen
          readers key on, and punctuation there earns nothing. */}
      <FieldLabel htmlFor={`matrix-${label}`} className="font-sans text-13/19 text-gray-12">
        {label}
      </FieldLabel>
      <Combobox
        id={`matrix-${label}`}
        size="xs"
        searchable={false}
        options={options.map((key) => ({ value: key, label: key }))}
        value={value}
        onChange={(picked) => picked && onChange(picked)}
      />
    </div>
  );
}

export function matrixValues(
  controls: Record<string, AnyControlDef>,
  values: Record<string, unknown>,
  xKey: string,
  yKey: string,
): { x: string[]; y: string[]; cell: (xi: number, yi: number) => Record<string, unknown> } {
  const xDef = controls[xKey];
  const yDef = controls[yKey];
  if (xDef?.kind !== 'select' || yDef?.kind !== 'select')
    throw new Error('matrix axes must be select controls');
  return {
    x: [...xDef.options],
    y: [...yDef.options],
    cell: (xi, yi) => ({ ...values, [xKey]: xDef.options[xi], [yKey]: yDef.options[yi] }),
  };
}

export function MatrixMode<C extends Record<string, AnyControlDef>>({
  playground,
  values,
  xKey,
  yKey,
  onXKeyChange,
  onYKeyChange,
}: {
  playground: PlaygroundDef<C>;
  values: Record<string, unknown>;
  xKey: string;
  yKey: string;
  onXKeyChange: (key: string) => void;
  onYKeyChange: (key: string) => void;
}) {
  const { x, y, cell } = matrixValues(playground.controls, values, xKey, yKey);
  const selectKeys = Object.keys(playground.controls).filter(
    (key) => playground.controls[key]?.kind === 'select',
  );

  return (
    <div className="flex flex-col gap-10">
      <div className="flex items-center gap-10">
        {/* The axes pick from the demo's own select controls — never more than
            a handful — so neither list needs a search box. */}
        <AxisPicker label="rows" value={yKey} options={selectKeys} onChange={onYKeyChange} />
        <AxisPicker label="columns" value={xKey} options={selectKeys} onChange={onXKeyChange} />
        <div className="flex-1" />
        <div className="font-mono text-11/13 tracking-wider text-gray-9">
          matrix: {yKey} × {xKey}
        </div>
      </div>

      <div
        className="grid gap-8"
        style={{
          gridTemplateColumns: `104px repeat(${x.length}, 1fr)`,
        }}
      >
        {/* Build flat grid items: corner, headers, then row+cells for each row */}
        {/* Corner cell */}
        <div key="corner" />

        {/* Column headers */}
        {x.map((xVal, xi) => (
          <div
            key={`header-${xi}`}
            className="flex items-center justify-center font-mono text-11/13 tracking-wider uppercase tracking-widest text-gray-9"
          >
            {xVal}
          </div>
        ))}

        {/* Rows and cells - flatten into the grid */}
        {y.flatMap((yVal, yi) => {
          const items: React.ReactNode[] = [];
          items.push(
            <div
              key={`label-${yi}`}
              className="flex items-center justify-center font-mono text-11/13 tracking-wider uppercase tracking-widest text-gray-9"
            >
              {yVal}
            </div>,
          );
          x.forEach((xVal, xi) => {
            items.push(
              <div
                key={`cell-${yi}-${xi}`}
                className="flex items-center justify-center rounded-lg border-1 border-gray-6 bg-surface-raised px-8 py-12"
              >
                {playground.render(cell(xi, yi) as ControlValues<C>)}
              </div>,
            );
          });
          return items;
        })}
      </div>
    </div>
  );
}
