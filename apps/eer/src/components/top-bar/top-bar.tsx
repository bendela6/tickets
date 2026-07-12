import { groupColor } from '../../engine/colors/group-color';
import type { RoutingMode } from '../../engine/model/types';
import { useDiagramActions, useDiagramModelOrNull, useDiagramUi, useDiagramView } from '../../state/diagram-context';
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
  'border border-border bg-surface text-muted text-sm font-medium px-2.5 py-1.5 rounded-md whitespace-nowrap ' +
  'hover:text-ink hover:border-border-2 hover:bg-surface-2';

interface TopBarProps {
  onSelfCheck: () => void;
}

export function TopBar({ onSelfCheck }: TopBarProps) {
  const model = useDiagramModelOrNull();
  const view = useDiagramView();
  const ui = useDiagramUi();
  const actions = useDiagramActions();

  const cycleRouting = () => {
    const order: RoutingMode[] = ['curved', 'avoid', 'ortho'];
    actions.setRouting(order[(order.indexOf(view.routing) + 1) % order.length]!);
  };

  return (
    <header className="z-10 flex flex-wrap items-center gap-x-3.5 gap-y-2 border-b border-border bg-bg/95 px-4 py-2.5">
      <div className="mr-auto">
        <h1 className="text-lg font-semibold tracking-tight">{model?.meta.title ?? 'EER model viewer'}</h1>
        <p className="mt-0.5 max-w-sm truncate text-sm text-muted">
          {model?.meta.description ??
            (model ? `${model.entities.length} entities · ${model.relationships.length} relationships` : 'loading…')}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <SearchBox />

        {model && model.groups.some((g) => !g.parent) && (
          <ToggleGroup label="Zones">
            {model.groups
              .filter((g) => !g.parent)
              .map((g) => (
                <Chip
                  key={g.id}
                  on={!ui.hidden.groups.has(g.id)}
                  color={groupColor(model, g.id, ui.colors)}
                  onClick={() => actions.toggleGroup(g.id)}
                >
                  {g.label}
                </Chip>
              ))}
          </ToggleGroup>
        )}

        {model && model.kinds.length > 0 && (
          <ToggleGroup label="Edges">
            {model.kinds.map((k) => (
              <Chip key={k.id} on={!ui.hidden.kinds.has(k.id)} onClick={() => actions.toggleKind(k.id)}>
                {k.label}
              </Chip>
            ))}
          </ToggleGroup>
        )}

        <button type="button" className={btn} title={ROUTING_TIP[view.routing]} onClick={cycleRouting}>
          {ROUTING_LABEL[view.routing]}
        </button>
        <button type="button" className={btn} title="Fit the diagram to the viewport" onClick={() => actions.fit()}>
          Fit
        </button>
        <button type="button" className={btn} title="Re-pack entities by zone" onClick={() => actions.rearrange()}>
          Rearrange
        </button>
        <button type="button" className={btn} title="Run the quality checks" onClick={onSelfCheck}>
          Self-check
        </button>
      </div>
    </header>
  );
}
