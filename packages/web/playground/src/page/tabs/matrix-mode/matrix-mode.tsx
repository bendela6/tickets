import { Icon, type AnyControlDef, type ControlValues, type PlaygroundDef } from '@tickets/ui';

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
        <label className="flex items-center gap-8 h-28 px-10 border-1 border-gray-7 rounded-sm bg-surface-raised font-sans text-13/19 text-gray-12 cursor-pointer">
          <span>rows:</span>
          <select
            value={yKey}
            onChange={(e) => onYKeyChange(e.target.value)}
            aria-label="rows"
            className="appearance-none bg-transparent border-none p-0 font-sans text-13/19 text-gray-12 cursor-pointer"
          >
            {selectKeys.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
          <Icon name="chevron-down" size="2xs" className="text-gray-9" />
        </label>
        <label className="flex items-center gap-8 h-28 px-10 border-1 border-gray-7 rounded-sm bg-surface-raised font-sans text-13/19 text-gray-12 cursor-pointer">
          <span>columns:</span>
          <select
            value={xKey}
            onChange={(e) => onXKeyChange(e.target.value)}
            aria-label="columns"
            className="appearance-none bg-transparent border-none p-0 font-sans text-13/19 text-gray-12 cursor-pointer"
          >
            {selectKeys.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
          <Icon name="chevron-down" size="2xs" className="text-gray-9" />
        </label>
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
