import { entityColor } from '../../engine/colors/entity-color';
import { columnRoles } from '../../engine/model/column-roles';
import type { Entity, Model } from '../../engine/model/types';
import { useDiagramActions } from '../../state/diagram-context';
import { cn } from '@tickets/ui';
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

// The column's fk-constraint target, if any: the column sits in some fk
// constraint's `columns` at index i, and refers to that constraint's
// `refColumns[i]` on `refTable`. Replaces the old per-field `ref`/`refField` —
// there is no such data on a Column any more (see types.ts); constraints are
// the only place a reference lives now (see column-roles.ts).
function fkTarget(e: Entity, fieldName: string): { table: string; field: string } | null {
  for (const c of e.constraints) {
    if (c.kind !== 'fk') continue;
    const i = c.columns.indexOf(fieldName);
    if (i === -1) continue;
    return { table: c.refTable, field: c.refColumns[i] ?? 'id' };
  }
  return null;
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
  model,
  id,
  colors,
}: {
  model: Model;
  id: string;
  colors?: ReadonlyMap<string, string>;
}) {
  const actions = useDiagramActions();
  const e = model.entityById.get(id);
  if (!e) return null;
  const group = model.groups.find((g) => g.id === e.group);
  const rels = relationshipsFor(model, id);
  const color = entityColor(model, id, colors);
  const roles = columnRoles(e);

  return (
    <div>
      <Header
        tone="entity"
        badge="Entity"
        title={e.label}
        titleColor={color}
        sub={
          <>
            {group?.label ?? e.group} · {e.columns.length} fields · {rels.length} relationships
          </>
        }
        description={e.description}
      />

      <div className="px-4 pb-5">
        <Section title="Fields" count={e.columns.length} />
        <div className="flex flex-col">
          {e.columns.map((f) => {
            const note = f.description || f.title;
            const role = roles.get(f.name);
            const badge = role?.pk ? 'pk' : role?.fk ? 'fk' : null;
            const fk = fkTarget(e, f.name);
            return (
              <div key={f.name} className="border-b border-gray-6/50 py-2 last:border-0">
                <div className="flex items-center gap-2">
                  <RoleTag role={badge} />
                  <span className={cn('font-mono text-sm', { 'text-yellow-9': badge === 'pk', 'text-gray-12': badge !== 'pk' })}>{f.name}</span>
                  {fk && (
                    <button
                      type="button"
                      className="ml-1 rounded bg-gray-3 px-1 py-px font-mono text-2xs text-green-9 hover:bg-gray-4"
                      onClick={() => {
                        actions.selectEntity(fk.table);
                        actions.centerOn(fk.table);
                      }}
                    >
                      → {fk.table}.{fk.field}
                    </button>
                  )}
                  <span className="ml-auto shrink-0 font-mono text-xs text-gray-9">{f.type}</span>
                </div>
                {note && <div className="mt-1 pl-7 text-xs leading-snug text-gray-11">{note}</div>}
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
              actions.isolateSilent(r.id);
              actions.centerOn(r.otherEntity);
            }}
          />
        ))}
      </div>
    </div>
  );
}
