import type { AnyControlDef, ControlValues, PlaygroundDef } from '@tickets/ui/gallery';

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
}: {
  playground: PlaygroundDef<C>;
  values: Record<string, unknown>;
  xKey: string;
  yKey: string;
}) {
  const { x, y, cell } = matrixValues(playground.controls, values, xKey, yKey);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2.5">
        <label className="flex items-center gap-2 h-7 px-2.5 border border-strong rounded-sm bg-surface font-sans text-ui text-ink cursor-pointer">
          <span>rows:</span>
          <select
            value={yKey}
            onChange={(e) => {
              // This will be handled by parent
            }}
            className="appearance-none bg-transparent border-none p-0 font-sans text-ui text-ink cursor-pointer"
          >
            {Object.keys(playground.controls)
              .filter((key) => playground.controls[key]?.kind === 'select')
              .map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
          </select>
        </label>
        <label className="flex items-center gap-2 h-7 px-2.5 border border-strong rounded-sm bg-surface font-sans text-ui text-ink cursor-pointer">
          <span>columns:</span>
          <select
            value={xKey}
            onChange={(e) => {
              // This will be handled by parent
            }}
            className="appearance-none bg-transparent border-none p-0 font-sans text-ui text-ink cursor-pointer"
          >
            {Object.keys(playground.controls)
              .filter((key) => playground.controls[key]?.kind === 'select')
              .map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
          </select>
        </label>
        <div className="flex-1" />
        <div className="font-mono text-label text-ink-3">
          matrix: {y.length} × {x.length}
        </div>
      </div>

      <div
        className="grid gap-2"
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
            className="flex items-center justify-center font-mono text-label uppercase tracking-(--tracking-caps) text-ink-3"
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
              className="flex items-center justify-center font-mono text-label uppercase tracking-(--tracking-caps) text-ink-3"
            >
              {yVal}
            </div>,
          );
          x.forEach((xVal, xi) => {
            items.push(
              <div
                key={`cell-${yi}-${xi}`}
                className="flex items-center justify-center rounded-card border border-hairline bg-raised px-2 py-3"
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
