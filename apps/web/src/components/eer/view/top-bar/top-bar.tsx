import { groupColor } from '../../engine/colors/group-color';
import type { RoutingMode } from '../../engine/model/types';
import { useDiagramActions, useDiagramModelOrNull, useDiagramUi, useDiagramView } from '../../state/diagram-context';
import { cn } from '@tickets/ui';
import { btn } from './button-class';
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

export function TopBar() {
  const model = useDiagramModelOrNull();
  const view = useDiagramView();
  const ui = useDiagramUi();
  const actions = useDiagramActions();

  const cycleRouting = () => {
    const order: RoutingMode[] = ['curved', 'avoid', 'ortho'];
    actions.setRouting(order[(order.indexOf(view.routing) + 1) % order.length]!);
  };

  return (
    <header
      className={cn(
        'z-10 flex flex-wrap items-center gap-x-16 gap-y-8 px-16 py-12',
        'border-b-1 border-gray-6 bg-gray-1/95',
      )}
    >
      <div className="mr-auto">
        {/* 'Database schema' is what the adapter sets meta.title to, so the
            fallback matches instead of flashing the old standalone app's name
            ('EER model viewer') for the frame before the model arrives. */}
        <h1 className="text-16 font-600 tracking-tight">{model?.meta.title ?? 'Database schema'}</h1>
        <p className="mt-4 max-w-sm truncate text-12 text-gray-11">
          {model?.meta.description ??
            (model ? `${model.entities.length} tables · ${model.relationships.length} relationships` : 'loading…')}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-8">
        <SearchBox />

        {model && model.groups.some((g) => !g.parent) && (
          <ToggleGroup label="Groups">
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
        <button type="button" className={btn} title="Re-pack entities by group" onClick={() => actions.rearrange()}>
          Rearrange
        </button>
      </div>
    </header>
  );
}
