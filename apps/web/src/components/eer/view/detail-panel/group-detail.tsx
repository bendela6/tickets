import { entityColor } from '../../engine/colors/entity-color';
import { entityIdsInGroup } from '../../engine/groups/entity-ids-in-group';
import type { Model } from '../../engine/model/types';
import { useDiagramActions } from '../../state/diagram-context';
import { cn } from '@tickets/ui';
import { Dot } from './dot';
import { Empty } from './empty';
import { Header } from './header';
import { RelRow, rowClass } from './rel-row';
import { Section } from './section';

export function GroupDetail({
  model,
  id,
  colors,
}: {
  model: Model;
  id: string;
  colors?: ReadonlyMap<string, string>;
}) {
  const actions = useDiagramActions();
  const group = model.groups.find((g) => g.id === id);
  const isSub = group?.parent != null;
  const parentGroup = isSub ? model.groups.find((g) => g.id === group?.parent) : undefined;
  const idset = entityIdsInGroup(model, id);
  const ents = model.entities.filter((e) => idset.has(e.id));
  const subgroups = model.groups.filter((g) => g.parent === id);
  const rels = model.relationships.filter((r) => idset.has(r.source) || idset.has(r.target));
  const external = rels.filter((r) => !(idset.has(r.source) && idset.has(r.target)));
  const internal = rels.length - external.length;

  return (
    <div>
      <Header
        tone={isSub ? 'subgroup' : 'group'}
        badge={isSub ? 'Subgroup' : 'Group'}
        title={group?.label ?? id}
        sub={
          <>
            {isSub ? `of ${parentGroup?.label ?? group?.parent}` : `${ents.length} tables`}
            {!isSub && subgroups.length > 0 && ` · ${subgroups.length} subgroups`} · {rels.length} relationships (
            {internal} internal)
          </>
        }
      />

      <div className="px-4 pb-5">
        {!isSub && subgroups.length > 0 && (
          <>
            <Section title="Subgroups" count={subgroups.length} />
            {subgroups.map((sg) => {
              const n = model.entities.filter((e) => e.group === sg.id).length;
              return (
                <button key={sg.id} type="button" className={rowClass} onClick={() => actions.selectGroup(sg.id)}>
                  <span className="truncate font-mono text-gray-50">{sg.label}</span>
                  <span className="ml-auto shrink-0 text-xs text-gray-400">{n} tables</span>
                </button>
              );
            })}
          </>
        )}

        <Section title="Tables" count={ents.length} />
        {ents.map((e) => (
          <button
            key={e.id}
            type="button"
            className={rowClass}
            onClick={() => {
              actions.selectEntity(e.id);
              actions.centerOn(e.id);
            }}
          >
            <Dot color={entityColor(model, e.id, colors)} />
            <span className="truncate font-mono text-gray-50">{e.label}</span>
            {e.group !== id && (
              <span className="ml-auto mr-1 shrink-0 text-2xs text-gray-400">
                {model.groups.find((g) => g.id === e.group)?.label ?? e.group}
              </span>
            )}
            <span className={cn('shrink-0 text-xs text-gray-400', { 'ml-auto': e.group === id })}>
              {e.columns.length} fields
            </span>
          </button>
        ))}

        <Section title={isSub ? 'Connections beyond this group' : 'Connections to other groups'} count={external.length} />
        {external.length === 0 && <Empty>None — this group is self-contained.</Empty>}
        {external.map((r) => {
          const outward = idset.has(r.source);
          const here = outward ? r.source : r.target;
          const otherEntity = outward ? r.target : r.source;
          const otherField = outward ? r.targetField : r.sourceField;
          return (
            <RelRow
              key={r.id}
              model={model}
              colors={colors}
              cardinality={r.cardinality}
              here={here}
              dir={outward ? 'out' : 'in'}
              otherEntity={otherEntity}
              otherField={otherField}
              onClick={() => actions.isolateSilent(r.id)}
            />
          );
        })}
      </div>
    </div>
  );
}
