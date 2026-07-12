import { entityColor } from '../../engine/colors/entity-color';
import type { Model, Relationship } from '../../engine/model/types';
import { useDiagramActions } from '../../state/diagram-context';
import { Card } from './card';
import { Dot } from './dot';
import { Header } from './header';
import { rowClass } from './rel-row';
import { Section } from './section';

export function EdgeDetail({
  model,
  id,
  colors,
}: {
  model: Model;
  id: string;
  colors?: ReadonlyMap<string, string>;
}) {
  const actions = useDiagramActions();
  const rel: Relationship | undefined = model.relById.get(id);
  if (!rel) return null;
  const goto = (entityId: string) => {
    actions.selectEntity(entityId);
    actions.centerOn(entityId);
  };
  const endpoint = (entityId: string, field: string, role: string) => (
    <button type="button" className={rowClass} onClick={() => goto(entityId)}>
      <Dot color={entityColor(model, entityId, colors)} />
      <span className="font-mono text-ink">{entityId}</span>
      <span className="font-mono text-dim">.{field}</span>
      <span className="ml-auto shrink-0 text-[0.6rem] uppercase tracking-[0.06em] text-dim">{role}</span>
    </button>
  );

  return (
    <div>
      <Header
        tone="edge"
        badge="Relationship"
        title={`${rel.source} → ${rel.target}`}
        sub={
          <>
            <Card>{rel.cardinality}</Card>
            <span className="ml-1.5">{rel.kind ?? 'edge'}</span>
            {rel.cardinalityInferred && <span className="ml-1.5 text-dim">· inferred from roles</span>}
          </>
        }
        description={rel.label}
      />

      <div className="px-4 pb-5">
        <Section title="Endpoints" />
        {endpoint(rel.source, rel.sourceField, 'source')}
        {endpoint(rel.target, rel.targetField, 'target')}
      </div>
    </div>
  );
}
