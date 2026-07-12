// Colour form — zones set their hue directly (with a reset once changed); every
// child (subgroup or table) shows its inherited colour dimmed until its override
// box is ticked, after which parent changes no longer touch it.

import { entityColor } from '../../engine/colors/entity-color';
import { groupColor } from '../../engine/colors/group-color';
import type { Model } from '../../engine/model/types';
import { cn } from '../../ui/cn';

const swatchClass =
  'h-4 w-6 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0 ' +
  'disabled:cursor-default disabled:opacity-25 ' +
  'swatch-wrapper:p-0 webkit-swatch:rounded-sm webkit-swatch:border-0 ' +
  'moz-swatch:rounded-sm moz-swatch:border-0';

interface ColorsFormProps {
  model: Model;
  colors: ReadonlyMap<string, string>;
  onChange: (next: ReadonlyMap<string, string>) => void;
}

export function ColorsForm({ model, colors, onChange }: ColorsFormProps) {
  const patch = (id: string, value: string | null) => {
    const next = new Map(colors);
    if (value === null) next.delete(id);
    else next.set(id, value);
    onChange(next);
  };

  const childRow = (id: string, label: string, effective: string, depth: 1 | 2) => {
    const overridden = colors.has(id);
    return (
      <label
        key={id}
        className={cn('flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.75 hover:bg-surface-2', {
          'ml-7': depth === 2,
          'ml-2.5': depth === 1,
        })}
      >
        <input
          type="checkbox"
          className="h-3 w-3 shrink-0 cursor-pointer accent-accent"
          title="Override the inherited colour"
          checked={overridden}
          onChange={(ev) => patch(id, ev.target.checked ? effective : null)}
        />
        <input
          type="color"
          className={swatchClass}
          value={effective}
          disabled={!overridden}
          onChange={(ev) => patch(id, ev.target.value)}
          aria-label={`${label} colour`}
        />
        <span className={cn('truncate font-mono text-sm', { 'text-ink': overridden, 'text-muted': !overridden })}>{label}</span>
      </label>
    );
  };

  const entityRows = (groupId: string, depth: 1 | 2) =>
    model.entities
      .filter((e) => e.group === groupId)
      .map((e) => childRow(e.id, e.label, entityColor(model, e.id, colors), depth));

  return (
    <div className="flex flex-col">
      {model.groups
        .filter((g) => !g.parent)
        .map((z) => (
          <div key={z.id} className="mb-2 flex flex-col gap-px">
            <div className="flex items-center gap-1.5 px-1 py-0.75">
              <input
                type="color"
                className={swatchClass}
                value={groupColor(model, z.id, colors)}
                onChange={(ev) => patch(z.id, ev.target.value)}
                aria-label={`${z.label} colour`}
              />
              <span className="truncate text-xs font-semibold uppercase tracking-wider text-ink">{z.label}</span>
              {colors.has(z.id) && (
                <button
                  type="button"
                  className="ml-auto shrink-0 rounded px-1 text-xs text-dim hover:bg-surface-2 hover:text-ink"
                  title="Back to the palette colour"
                  onClick={() => patch(z.id, null)}
                >
                  reset
                </button>
              )}
            </div>
            {entityRows(z.id, 1)}
            {model.groups
              .filter((g) => g.parent === z.id)
              .map((sg) => (
                <div key={sg.id} className="flex flex-col gap-px">
                  {childRow(sg.id, sg.label, groupColor(model, sg.id, colors), 1)}
                  {entityRows(sg.id, 2)}
                </div>
              ))}
          </div>
        ))}
    </div>
  );
}
