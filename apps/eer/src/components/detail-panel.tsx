import type { ReactNode } from 'react';

import type { EerDiagram } from '../engine/diagram';
import type { Entity, Model, Relationship, Selection } from '../engine/types';
import { cn } from '../ui/cn';

interface DetailPanelProps {
  engine: EerDiagram | null;
  model: Model | null;
  selection: Selection;
}

export function DetailPanel({ engine, model, selection }: DetailPanelProps) {
  return (
    <aside className="w-[320px] overflow-auto border-l border-border bg-surface p-4 text-[0.8rem]">
      {model && selection.type === 'entity' && <EntityDetail engine={engine} model={model} id={selection.id} />}
      {model && selection.type === 'group' && <GroupDetail engine={engine} model={model} id={selection.id} />}
      {model && selection.type === 'edge' && <EdgeDetail engine={engine} model={model} id={selection.id} />}
      {(!model || selection.type === 'none') && <EmptyState />}
    </aside>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="mb-[0.45rem] mt-4 border-t border-border pt-[0.7rem] text-[0.68rem] uppercase tracking-[0.06em] text-dim">
      {children}
    </div>
  );
}

function Sub({ children }: { children: ReactNode }) {
  return <div className="mb-[0.8rem] text-[0.72rem] text-dim">{children}</div>;
}

const relRowClass =
  'flex w-full cursor-pointer items-center gap-1.5 rounded-md border border-transparent px-[0.45rem] py-[0.35rem] text-left text-[0.74rem] hover:border-border hover:bg-surface-2';

interface RelView {
  id: string;
  dir: 'out' | 'in';
  cardinality: string;
  here: string;
  there: string;
}

function relationshipsFor(model: Model, id: string): RelView[] {
  const out: RelView[] = [];
  for (const r of model.relationships) {
    if (r.source === id) out.push({ id: r.id, dir: 'out', cardinality: r.cardinality, here: r.sourceField, there: `${r.target}.${r.targetField}` });
    else if (r.target === id) out.push({ id: r.id, dir: 'in', cardinality: r.cardinality, here: r.targetField, there: `${r.source}.${r.sourceField}` });
  }
  return out;
}

function EntityDetail({ engine, model, id }: { engine: EerDiagram | null; model: Model; id: string }) {
  const e = model.entityById.get(id);
  if (!e) return null;
  const group = model.groups.find((g) => g.id === e.group);
  const rels = relationshipsFor(model, id);

  return (
    <div>
      <h2 className="mb-0.5 font-mono text-base font-medium">{e.label}</h2>
      <Sub>
        {group?.label ?? e.group} · {e.fields.length} fields
      </Sub>
      {e.description && <div className="mb-4 leading-relaxed text-muted">{e.description}</div>}

      <SectionTitle>Fields</SectionTitle>
      <table className="w-full border-collapse">
        <tbody>
          {e.fields.map((f) => (
            <tr key={f.name}>
              <td className="py-[0.22rem] pr-[0.3rem] align-top font-mono text-[0.74rem] text-ink">
                <RoleTag role={f.role} />
                {f.name}
                {f.ref && <span className="ml-1 text-[0.68rem] text-dim">→ {f.ref}.{f.refField ?? 'id'}</span>}
                {f.title && <div className="text-[0.68rem] text-dim">{f.title}</div>}
                {f.description && <div className="text-[0.68rem] text-dim">{f.description}</div>}
              </td>
              <td className="py-[0.22rem] text-right align-top font-mono text-[0.68rem] text-dim">{f.type}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <SectionTitle>Relationships ({rels.length})</SectionTitle>
      {rels.length === 0 && <div className="leading-relaxed text-muted">No relationships.</div>}
      {rels.map((r) => (
        <button
          key={r.id}
          type="button"
          className={relRowClass}
          onClick={() => {
            engine?.isolateSilent(r.id);
            const rel = model.relById.get(r.id);
            if (rel) engine?.centerOn(rel.source === id ? rel.target : rel.source);
          }}
        >
          <span className="shrink-0 font-mono text-[0.64rem] text-accent">{r.cardinality}</span>
          <span className="truncate font-mono text-muted">{r.here}</span>
          <span className="shrink-0 text-dim">{r.dir === 'out' ? '→' : '←'}</span>
          <span className="truncate font-mono text-muted">{r.there}</span>
        </button>
      ))}
    </div>
  );
}

function GroupDetail({ engine, model, id }: { engine: EerDiagram | null; model: Model; id: string }) {
  const group = model.groups.find((g) => g.id === id);
  const ents = model.entities.filter((e) => e.group === id);
  const idset = new Set(ents.map((e) => e.id));
  const rels = model.relationships.filter((r) => idset.has(r.source) || idset.has(r.target));
  const external = rels.filter((r) => !(idset.has(r.source) && idset.has(r.target)));
  const internal = rels.length - external.length;

  return (
    <div>
      <h2 className="mb-0.5 font-mono text-base font-medium">{group?.label ?? id}</h2>
      <Sub>
        zone · {ents.length} tables · {rels.length} relationships ({internal} internal)
      </Sub>

      <SectionTitle>Tables</SectionTitle>
      {ents.map((e) => (
        <button
          key={e.id}
          type="button"
          className={relRowClass}
          onClick={() => {
            engine?.selectEntity(e.id);
            engine?.centerOn(e.id);
          }}
        >
          <span className="truncate font-mono text-muted">{e.label}</span>
          <span className="ml-auto shrink-0 text-[0.68rem] text-dim">{e.fields.length} fields</span>
        </button>
      ))}

      <SectionTitle>Connections to other zones ({external.length})</SectionTitle>
      {external.length === 0 && <div className="leading-relaxed text-muted">None — this zone is self-contained.</div>}
      {external.map((r) => {
        const outward = idset.has(r.source);
        const here = outward ? r.source : r.target;
        const there = outward ? `${r.target}.${r.targetField}` : `${r.source}.${r.sourceField}`;
        return (
          <button key={r.id} type="button" className={relRowClass} onClick={() => engine?.isolateSilent(r.id)}>
            <span className="shrink-0 font-mono text-[0.64rem] text-accent">{r.cardinality}</span>
            <span className="truncate font-mono text-muted">{here}</span>
            <span className="shrink-0 text-dim">{outward ? '→' : '←'}</span>
            <span className="truncate font-mono text-muted">{there}</span>
          </button>
        );
      })}
    </div>
  );
}

function EdgeDetail({ engine, model, id }: { engine: EerDiagram | null; model: Model; id: string }) {
  const rel: Relationship | undefined = model.relById.get(id);
  if (!rel) return null;
  const goto = (entityId: string) => {
    engine?.selectEntity(entityId);
    engine?.centerOn(entityId);
  };
  return (
    <div>
      <h2 className="mb-0.5 font-mono text-base font-medium">relationship</h2>
      <Sub>
        {rel.kind ?? 'edge'} · {rel.cardinality}
      </Sub>
      <div className="mb-4 leading-relaxed text-muted">
        <span className="font-mono">
          {rel.source}.{rel.sourceField}
        </span>
        {' → '}
        <span className="font-mono">
          {rel.target}.{rel.targetField}
        </span>
      </div>
      {rel.label && <div className="mb-4 leading-relaxed text-muted">{rel.label}</div>}
      {rel.cardinalityInferred && <Sub>cardinality inferred from field roles</Sub>}

      <SectionTitle>Endpoints</SectionTitle>
      {[rel.source, rel.target].map((entityId) => (
        <button key={entityId} type="button" className={relRowClass} onClick={() => goto(entityId)}>
          <span className="font-mono text-muted">{entityId}</span>
        </button>
      ))}
    </div>
  );
}

function RoleTag({ role }: { role: Entity['fields'][number]['role'] }) {
  return (
    <span
      className={cn(
        'inline-block w-[22px] font-mono text-[0.56rem] font-semibold',
        role === 'pk' && 'text-pk',
        role === 'fk' && 'text-fk',
      )}
    >
      {role ? role.toUpperCase() : ''}
    </span>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-b-2 border-border bg-surface-2 px-[0.35rem] py-[0.05rem] font-mono text-[0.7rem] text-ink">
      {children}
    </kbd>
  );
}

function EmptyState() {
  const rows: [string, string][] = [
    ['wheel', 'zoom toward the cursor'],
    ['middle-drag', 'pan the canvas'],
    ['left-drag', 'move an entity (or a whole zone)'],
    ['click', 'entity → focus its relationships'],
    ['click', 'a zone → show only its connections'],
    ['hover', 'a field → light its edges'],
    ['click', 'an edge → isolate that path'],
    ['Esc', 'empty click → clear focus'],
  ];
  return (
    <div>
      <h2 className="mb-0.5 font-mono text-base font-medium">EER viewer</h2>
      <Sub>Click an entity, zone, or edge to inspect it.</Sub>
      <div className="leading-relaxed text-muted">
        {rows.map(([k, label], i) => (
          <div key={i} className="my-[0.3rem]">
            <Kbd>{k}</Kbd> {label}
          </div>
        ))}
      </div>
    </div>
  );
}
