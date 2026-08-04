import type { Model } from '../../engine/model/types';
import { Badge } from './badge';
import { Kbd } from './kbd';
import { Section } from './section';
import { Stat } from './stat';

export function EmptyState({ model }: { model: Model | null }) {
  const rows: [string, string][] = [
    ['wheel', 'zoom toward the cursor'],
    ['middle-drag', 'pan the canvas'],
    ['left-drag', 'move an entity, group, or subgroup'],
    ['drag edge', 'resize a group or subgroup'],
    ['click', 'entity → focus its relationships'],
    ['click', 'a group → show only its connections'],
    ['hover', 'a field → light its edges'],
    ['click', 'an edge → isolate that path'],
    ['Esc', 'empty click → clear focus'],
  ];
  const groups = model?.groups.filter((g) => !g.parent).length ?? 0;
  const subgroups = model?.groups.filter((g) => g.parent).length ?? 0;

  return (
    <div>
      <div className="border-b-1 border-gray-6 px-16 pb-12 pt-16">
        <Badge tone="entity">Overview</Badge>
        {/* Matches what the adapter sets meta.title to, so nothing flashes the
            standalone app's old name before the model lands. */}
        <h2 className="mt-8 font-mono text-16 font-500 text-gray-12">{model?.meta.title ?? 'Database schema'}</h2>
        <div className="mt-4 text-11 text-gray-11">Click an entity, group, or edge to inspect it.</div>
      </div>

      <div className="px-16 pb-20 pt-12">
        {model && (
          <div className="mb-16 flex gap-8">
            <Stat value={model.entities.length} label="tables" />
            <Stat value={model.relationships.length} label="edges" />
            <Stat value={groups} label="groups" />
            {subgroups > 0 && <Stat value={subgroups} label="subgroups" />}
          </div>
        )}

        <Section title="Controls" />
        <div className="flex flex-col gap-8 text-12 leading-relaxed text-gray-11">
          {rows.map(([k, label], i) => (
            <div key={i} className="flex items-baseline gap-8">
              <Kbd>{k}</Kbd>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
