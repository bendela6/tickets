import type { Model } from '../../engine/model/types';
import { Badge } from './badge';
import { ColorsForm } from './colors-form';
import { Kbd } from './kbd';
import { Section } from './section';
import { Stat } from './stat';

export function EmptyState({
  model,
  colors = new Map<string, string>(),
  onColorsChange,
}: {
  model: Model | null;
  colors?: ReadonlyMap<string, string>;
  onColorsChange?: (next: ReadonlyMap<string, string>) => void;
}) {
  const rows: [string, string][] = [
    ['wheel', 'zoom toward the cursor'],
    ['middle-drag', 'pan the canvas'],
    ['left-drag', 'move an entity, subgroup, or zone'],
    ['drag edge', 'resize a zone or subgroup'],
    ['click', 'entity → focus its relationships'],
    ['click', 'a zone → show only its connections'],
    ['hover', 'a field → light its edges'],
    ['click', 'an edge → isolate that path'],
    ['Esc', 'empty click → clear focus'],
  ];
  const zones = model?.groups.filter((g) => !g.parent).length ?? 0;
  const subgroups = model?.groups.filter((g) => g.parent).length ?? 0;

  return (
    <div>
      <div className="border-b border-gray-600 px-4 pb-3 pt-4">
        <Badge tone="entity">Overview</Badge>
        <h2 className="mt-2 font-mono text-lg font-medium text-gray-50">{model?.meta.title ?? 'EER viewer'}</h2>
        <div className="mt-1 text-xs text-gray-400">Click an entity, zone, or edge to inspect it.</div>
      </div>

      <div className="px-4 pb-5 pt-3">
        {model && (
          <div className="mb-4 flex gap-2">
            <Stat value={model.entities.length} label="tables" />
            <Stat value={model.relationships.length} label="edges" />
            <Stat value={zones} label="zones" />
            {subgroups > 0 && <Stat value={subgroups} label="groups" />}
          </div>
        )}

        {model && onColorsChange && (
          <>
            <Section title="Colors" />
            <ColorsForm model={model} colors={colors} onChange={onColorsChange} />
          </>
        )}

        <Section title="Controls" />
        <div className="flex flex-col gap-2 text-sm leading-relaxed text-gray-200">
          {rows.map(([k, label], i) => (
            <div key={i} className="flex items-baseline gap-2">
              <Kbd>{k}</Kbd>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
