import type { EerDiagram } from '../../engine/diagram/eer-diagram';
import { entityColor } from '../../engine/render/entity-color';
import type { Model } from '../../engine/model/types';
import { cn } from '../../ui/cn';
import { Empty } from './empty';
import { Header } from './header';
import { RelRow } from './rel-row';
import { RoleTag } from './role-tag';
import { Section } from './section';

interface RelView {
  id: string;
  dir: 'out' | 'in';
  cardinality: string;
  here: string;
  otherEntity: string;
  otherField: string;
}

function relationshipsFor(model: Model, id: string): RelView[] {
  const out: RelView[] = [];
  for (const r of model.relationships) {
    if (r.source === id)
      out.push({ id: r.id, dir: 'out', cardinality: r.cardinality, here: r.sourceField, otherEntity: r.target, otherField: r.targetField });
    else if (r.target === id)
      out.push({ id: r.id, dir: 'in', cardinality: r.cardinality, here: r.targetField, otherEntity: r.source, otherField: r.sourceField });
  }
  return out;
}

export function EntityDetail({
  engine,
  model,
  id,
  colors,
}: {
  engine: EerDiagram | null;
  model: Model;
  id: string;
  colors?: ReadonlyMap<string, string>;
}) {
  const e = model.entityById.get(id);
  if (!e) return null;
  const group = model.groups.find((g) => g.id === e.group);
  const rels = relationshipsFor(model, id);
  const color = entityColor(model, id, colors);

  return (
    <div>
      <Header
        tone="entity"
        badge="Entity"
        title={e.label}
        titleColor={color}
        sub={
          <>
            {group?.label ?? e.group} · {e.fields.length} fields · {rels.length} relationships
          </>
        }
        description={e.description}
      />

      <div className="px-4 pb-5">
        <Section title="Fields" count={e.fields.length} />
        <div className="flex flex-col">
          {e.fields.map((f) => {
            const note = f.description || f.title;
            return (
              <div key={f.name} className="border-b border-border/50 py-[0.4rem] last:border-0">
                <div className="flex items-center gap-1.5">
                  <RoleTag role={f.role} />
                  <span className={cn('font-mono text-[0.76rem]', f.role === 'pk' ? 'text-pk' : 'text-ink')}>{f.name}</span>
                  {f.ref && (
                    <button
                      type="button"
                      className="ml-1 rounded bg-surface-2 px-1 py-px font-mono text-[0.62rem] text-fk hover:bg-surface-3"
                      onClick={() => {
                        engine?.selectEntity(f.ref!);
                        engine?.centerOn(f.ref!);
                      }}
                    >
                      → {f.ref}.{f.refField ?? 'id'}
                    </button>
                  )}
                  <span className="ml-auto shrink-0 font-mono text-[0.66rem] text-dim">{f.type}</span>
                </div>
                {note && <div className="mt-0.5 pl-[1.7rem] text-[0.68rem] leading-snug text-muted">{note}</div>}
              </div>
            );
          })}
        </div>

        <Section title="Relationships" count={rels.length} />
        {rels.length === 0 && <Empty>No relationships.</Empty>}
        {rels.map((r) => (
          <RelRow
            key={r.id}
            model={model}
            colors={colors}
            cardinality={r.cardinality}
            here={r.here}
            dir={r.dir}
            otherEntity={r.otherEntity}
            otherField={r.otherField}
            onClick={() => {
              engine?.isolateSilent(r.id);
              engine?.centerOn(r.otherEntity);
            }}
          />
        ))}
      </div>
    </div>
  );
}
