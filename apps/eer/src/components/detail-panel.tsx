import type { ReactNode } from 'react';

import type { EerDiagram } from '../engine/diagram';
import { entityIdsInGroup } from '../engine/groups';
import { entityColor } from '../engine/palette';
import type { Entity, Model, Relationship, Selection } from '../engine/types';
import { cn } from '../ui/cn';

interface DetailPanelProps {
  engine: EerDiagram | null;
  model: Model | null;
  selection: Selection;
}

export function DetailPanel({ engine, model, selection }: DetailPanelProps) {
  return (
    <aside className="w-[320px] overflow-auto border-l border-border bg-surface text-[0.8rem]">
      {model && selection.type === 'entity' && <EntityDetail engine={engine} model={model} id={selection.id} />}
      {model && selection.type === 'group' && <GroupDetail engine={engine} model={model} id={selection.id} />}
      {model && selection.type === 'edge' && <EdgeDetail engine={engine} model={model} id={selection.id} />}
      {(!model || selection.type === 'none') && <EmptyState model={model} />}
    </aside>
  );
}

// ---- primitives ----

type Tone = 'entity' | 'zone' | 'subgroup' | 'edge';
const toneClass: Record<Tone, string> = {
  entity: 'bg-accent/15 text-accent',
  zone: 'bg-[#9085e9]/18 text-[#b0a8f2]',
  subgroup: 'bg-fk/15 text-fk',
  edge: 'bg-pk/15 text-pk',
};

function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        'rounded px-1.5 py-0.5 font-mono text-[0.58rem] font-semibold uppercase tracking-[0.08em]',
        toneClass[tone],
      )}
    >
      {children}
    </span>
  );
}

function Dot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      className={cn('inline-block h-2 w-2 shrink-0 rounded-full', className)}
      style={{ backgroundColor: color }}
    />
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <span className="shrink-0 rounded bg-surface-3 px-1.5 py-px font-mono text-[0.62rem] text-accent">{children}</span>
  );
}

// Sticky panel header shared by every view.
function Header({
  tone,
  badge,
  title,
  titleColor,
  sub,
  description,
}: {
  tone: Tone;
  badge: string;
  title: string;
  titleColor?: string;
  sub: ReactNode;
  description?: string | null;
}) {
  return (
    <div className="sticky top-0 z-10 border-b border-border bg-surface px-4 pb-3 pt-3.5">
      <div className="mb-1.5 flex items-center gap-2">
        <Badge tone={tone}>{badge}</Badge>
        {titleColor && <Dot color={titleColor} />}
      </div>
      <h2 className="font-mono text-[0.98rem] font-medium leading-tight text-ink">{title}</h2>
      <div className="mt-1 text-[0.7rem] text-dim">{sub}</div>
      {description && <p className="mt-2 text-[0.74rem] leading-relaxed text-muted">{description}</p>}
    </div>
  );
}

function Section({ title, count }: { title: string; count?: number }) {
  return (
    <div className="mb-1.5 mt-4 flex items-baseline gap-1.5 text-[0.64rem] font-semibold uppercase tracking-[0.07em] text-dim">
      <span>{title}</span>
      {count != null && <span className="font-mono text-dim/80">{count}</span>}
    </div>
  );
}

const rowClass =
  'flex w-full cursor-pointer items-center gap-1.5 rounded-md border border-transparent px-2 py-[0.4rem] text-left text-[0.74rem] hover:border-border-2 hover:bg-surface-2';

function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-md bg-surface-2/50 px-2 py-2 text-[0.74rem] leading-relaxed text-muted">{children}</div>;
}

// ---- relationships helper ----

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

function RelRow({
  model,
  cardinality,
  here,
  dir,
  otherEntity,
  otherField,
  onClick,
}: {
  model: Model;
  cardinality: string;
  here: string;
  dir: 'out' | 'in';
  otherEntity: string;
  otherField: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className={rowClass} onClick={onClick}>
      <Card>{cardinality}</Card>
      <span className="truncate font-mono text-muted">{here}</span>
      <span className="shrink-0 text-dim">{dir === 'out' ? '→' : '←'}</span>
      <Dot color={entityColor(model, otherEntity)} />
      <span className="truncate font-mono text-ink">{otherEntity}</span>
      <span className="truncate font-mono text-dim">.{otherField}</span>
    </button>
  );
}

// ---- entity ----

function EntityDetail({ engine, model, id }: { engine: EerDiagram | null; model: Model; id: string }) {
  const e = model.entityById.get(id);
  if (!e) return null;
  const group = model.groups.find((g) => g.id === e.group);
  const rels = relationshipsFor(model, id);
  const color = entityColor(model, id);

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

// ---- group ----

function GroupDetail({ engine, model, id }: { engine: EerDiagram | null; model: Model; id: string }) {
  const group = model.groups.find((g) => g.id === id);
  const isSub = group?.parent != null;
  const parentZone = isSub ? model.groups.find((g) => g.id === group?.parent) : undefined;
  const idset = entityIdsInGroup(model, id);
  const ents = model.entities.filter((e) => idset.has(e.id));
  const subgroups = model.groups.filter((g) => g.parent === id);
  const rels = model.relationships.filter((r) => idset.has(r.source) || idset.has(r.target));
  const external = rels.filter((r) => !(idset.has(r.source) && idset.has(r.target)));
  const internal = rels.length - external.length;

  return (
    <div>
      <Header
        tone={isSub ? 'subgroup' : 'zone'}
        badge={isSub ? 'Subgroup' : 'Zone'}
        title={group?.label ?? id}
        sub={
          <>
            {isSub ? `of ${parentZone?.label ?? group?.parent}` : `${ents.length} tables`}
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
                <button key={sg.id} type="button" className={rowClass} onClick={() => engine?.selectGroup(sg.id)}>
                  <span className="truncate font-mono text-ink">{sg.label}</span>
                  <span className="ml-auto shrink-0 text-[0.66rem] text-dim">{n} tables</span>
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
              engine?.selectEntity(e.id);
              engine?.centerOn(e.id);
            }}
          >
            <Dot color={entityColor(model, e.id)} />
            <span className="truncate font-mono text-ink">{e.label}</span>
            {e.group !== id && (
              <span className="ml-auto mr-1 shrink-0 text-[0.62rem] text-dim">
                {model.groups.find((g) => g.id === e.group)?.label ?? e.group}
              </span>
            )}
            <span className={cn('shrink-0 text-[0.66rem] text-dim', e.group === id && 'ml-auto')}>
              {e.fields.length} fields
            </span>
          </button>
        ))}

        <Section title={isSub ? 'Connections beyond this group' : 'Connections to other zones'} count={external.length} />
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
              cardinality={r.cardinality}
              here={here}
              dir={outward ? 'out' : 'in'}
              otherEntity={otherEntity}
              otherField={otherField}
              onClick={() => engine?.isolateSilent(r.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

// ---- edge ----

function EdgeDetail({ engine, model, id }: { engine: EerDiagram | null; model: Model; id: string }) {
  const rel: Relationship | undefined = model.relById.get(id);
  if (!rel) return null;
  const goto = (entityId: string) => {
    engine?.selectEntity(entityId);
    engine?.centerOn(entityId);
  };
  const endpoint = (entityId: string, field: string, role: string) => (
    <button type="button" className={rowClass} onClick={() => goto(entityId)}>
      <Dot color={entityColor(model, entityId)} />
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

function RoleTag({ role }: { role: Entity['fields'][number]['role'] }) {
  if (!role)
    return <span className="inline-block w-7 shrink-0" aria-hidden />;
  return (
    <span
      className={cn(
        'inline-block w-7 shrink-0 rounded text-center font-mono text-[0.54rem] font-semibold leading-[0.95rem]',
        role === 'pk' ? 'bg-pk/15 text-pk' : 'bg-fk/15 text-fk',
      )}
    >
      {role.toUpperCase()}
    </span>
  );
}

// ---- empty ----

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-b-2 border-border bg-surface-2 px-[0.35rem] py-[0.05rem] font-mono text-[0.7rem] text-ink">
      {children}
    </kbd>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex-1 rounded-md border border-border bg-surface-2 px-2 py-1.5 text-center">
      <div className="font-mono text-[1.05rem] font-medium text-ink">{value}</div>
      <div className="text-[0.6rem] uppercase tracking-[0.05em] text-dim">{label}</div>
    </div>
  );
}

function EmptyState({ model }: { model: Model | null }) {
  const rows: [string, string][] = [
    ['wheel', 'zoom toward the cursor'],
    ['middle-drag', 'pan the canvas'],
    ['left-drag', 'move an entity, subgroup, or zone'],
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
      <div className="border-b border-border px-4 pb-3 pt-3.5">
        <Badge tone="entity">Overview</Badge>
        <h2 className="mt-1.5 font-mono text-[0.98rem] font-medium text-ink">{model?.meta.title ?? 'EER viewer'}</h2>
        <div className="mt-1 text-[0.7rem] text-dim">Click an entity, zone, or edge to inspect it.</div>
      </div>

      <div className="px-4 pb-5 pt-3">
        {model && (
          <div className="mb-4 flex gap-1.5">
            <Stat value={model.entities.length} label="tables" />
            <Stat value={model.relationships.length} label="edges" />
            <Stat value={zones} label="zones" />
            {subgroups > 0 && <Stat value={subgroups} label="groups" />}
          </div>
        )}

        <Section title="Controls" />
        <div className="flex flex-col gap-2 text-[0.74rem] leading-relaxed text-muted">
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
