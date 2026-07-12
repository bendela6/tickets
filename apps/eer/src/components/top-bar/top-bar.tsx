import type { EerDiagram } from '../../engine/diagram/eer-diagram';
import type { Model, RoutingMode } from '../../engine/model/types';
import { groupColor } from '../../engine/render/group-color';
import { Chip } from './chip';
import { SearchBox } from './search-box';
import { ToggleGroup } from './toggle-group';

const ROUTING_LABEL: Record<RoutingMode, string> = {
  curved: 'Lines: curved',
  avoid: 'Lines: avoid',
  ortho: 'Lines: ortho',
};
const ROUTING_TIP: Record<RoutingMode, string> = {
  curved: 'Direct curves (may cross cards)',
  avoid: 'Curves routed around cards',
  ortho: 'Horizontal / vertical only',
};

const btn =
  'border border-border bg-surface text-muted text-[0.74rem] font-medium px-2.5 py-1.5 rounded-md whitespace-nowrap ' +
  'hover:text-ink hover:border-border-2 hover:bg-surface-2';

interface TopBarProps {
  engine: EerDiagram | null;
  model: Model | null;
  routing: RoutingMode;
  onCycleRouting: () => void;
  hiddenGroups: ReadonlySet<string>;
  hiddenKinds: ReadonlySet<string>;
  colors?: ReadonlyMap<string, string>;
  onToggleGroup: (id: string) => void;
  onToggleKind: (id: string) => void;
  onFit: () => void;
  onRearrange: () => void;
  onSelfCheck: () => void;
}

export function TopBar(props: TopBarProps) {
  const { engine, model } = props;

  return (
    <header className="z-10 flex flex-wrap items-center gap-x-[0.9rem] gap-y-2 border-b border-border bg-[rgba(12,14,20,0.96)] px-4 py-2.5">
      <div className="mr-auto">
        <h1 className="text-[0.98rem] font-semibold tracking-[-0.01em]">{model?.meta.title ?? 'EER model viewer'}</h1>
        <p className="mt-0.5 max-w-[52ch] truncate text-[0.72rem] text-muted">
          {model?.meta.description ??
            (model ? `${model.entities.length} entities · ${model.relationships.length} relationships` : 'loading…')}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <SearchBox engine={engine} />

        {model && model.groups.some((g) => !g.parent) && (
          <ToggleGroup label="Zones">
            {model.groups
              .filter((g) => !g.parent)
              .map((g) => (
                <Chip
                  key={g.id}
                  on={!props.hiddenGroups.has(g.id)}
                  color={groupColor(model, g.id, props.colors)}
                  onClick={() => props.onToggleGroup(g.id)}
                >
                  {g.label}
                </Chip>
              ))}
          </ToggleGroup>
        )}

        {model && model.kinds.length > 0 && (
          <ToggleGroup label="Edges">
            {model.kinds.map((k) => (
              <Chip key={k.id} on={!props.hiddenKinds.has(k.id)} onClick={() => props.onToggleKind(k.id)}>
                {k.label}
              </Chip>
            ))}
          </ToggleGroup>
        )}

        <button type="button" className={btn} title={ROUTING_TIP[props.routing]} onClick={props.onCycleRouting}>
          {ROUTING_LABEL[props.routing]}
        </button>
        <button type="button" className={btn} title="Fit the diagram to the viewport" onClick={props.onFit}>
          Fit
        </button>
        <button type="button" className={btn} title="Re-pack entities by zone" onClick={props.onRearrange}>
          Rearrange
        </button>
        <button type="button" className={btn} title="Run the quality checks" onClick={props.onSelfCheck}>
          Self-check
        </button>
      </div>
    </header>
  );
}
