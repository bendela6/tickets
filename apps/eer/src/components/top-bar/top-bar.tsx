import { groupColor } from '../../engine/colors/group-color';
import type { RoutingMode } from '../../engine/model/types';
import { useDiagramActions, useDiagramModelOrNull, useDiagramUi, useDiagramView } from '../../state/diagram-context';
import { cn } from '../../ui/cn';
import { useEditor } from '../editor';
import { btn } from './button-class';
import { Chip } from './chip';
import { ModelMenu } from './model-menu';
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
  const { openModal } = useEditor();

  const cycleRouting = () => {
    const order: RoutingMode[] = ['curved', 'avoid', 'ortho'];
    actions.setRouting(order[(order.indexOf(view.routing) + 1) % order.length]!);
  };

  return (
    <header
      className={cn(
        'z-10 flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3',
        'border-b border-gray-600 bg-gray-950/95',
      )}
    >
      <div className="mr-auto">
        <h1 className="text-lg font-semibold tracking-tight">{model?.meta.title ?? 'EER model viewer'}</h1>
        <p className="mt-1 max-w-sm truncate text-sm text-gray-200">
          {model?.meta.description ??
            (model ? `${model.entities.length} entities · ${model.relationships.length} relationships` : 'loading…')}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ModelMenu />
        <SearchBox />

        <button
          type="button"
          className={btn}
          disabled={!model}
          title="Add a zone, subgroup, or table"
          onClick={() => openModal({ kind: 'add' })}
        >
          + Add
        </button>

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

        {import.meta.env.DEV && (
          <>
            <button
              type="button"
              className={btn}
              title="Dry-run a scan of a drizzle schema module against this model"
              onClick={() => openModal({ kind: 'import' })}
            >
              Import
            </button>
            <button
              type="button"
              className={btn}
              disabled={!model}
              title="Preview and write this model out as a drizzle schema module"
              onClick={() => openModal({ kind: 'export' })}
            >
              Export
            </button>
          </>
        )}
      </div>
    </header>
  );
}
