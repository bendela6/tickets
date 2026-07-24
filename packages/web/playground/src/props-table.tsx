import type { AnyControlDef } from '@tickets/ui/gallery';

const cell = 'font-mono text-meta';
function row(def: AnyControlDef): { type: string; options: string; def: string; unset: string } {
  switch (def.kind) {
    case 'select':
      return { type: 'enum', options: def.options.join(' · '), def: def.initial ?? '—', unset: def.allowNone ? 'yes' : 'no' };
    case 'boolean':
      return { type: 'boolean', options: '—', def: String(def.initial), unset: 'no' };
    case 'text':
      return { type: 'string', options: '—', def: def.initial || '—', unset: 'no' };
    case 'number':
      return { type: 'number', options: def.min !== undefined || def.max !== undefined ? `${def.min ?? '…'} – ${def.max ?? '…'}` : '—', def: String(def.initial), unset: 'no' };
  }
}

export function PropsTable({ controls }: { controls: Record<string, AnyControlDef> }) {
  return (
    <div className="overflow-hidden rounded-card border border-hairline bg-raised">
      <div className="grid grid-cols-[110px_100px_1fr_100px_64px] gap-3 border-b border-hairline px-3.5 py-2 font-mono text-label uppercase tracking-(--tracking-caps) text-ink-3">
        <span>Prop</span><span>Type</span><span>Options / range</span><span>Default</span><span>Unset?</span>
      </div>
      {Object.entries(controls).map(([name, def], i) => {
        const r = row(def);
        return (
          <div key={name} className={`grid grid-cols-[110px_100px_1fr_100px_64px] items-center gap-3 px-3.5 py-2 ${i > 0 ? 'border-t border-hairline' : ''}`}>
            <span className={`${cell} font-medium text-ink`}>{name}</span>
            <span className={`${cell} text-ink-3`}>{r.type}</span>
            <span className={`${cell} text-ink-2`}>{r.options}</span>
            <span className={`${cell} text-ink-2`}>{r.def}</span>
            <span className={`${cell} text-ink-3`}>{r.unset}</span>
          </div>
        );
      })}
    </div>
  );
}
