import type { CollectedDemo, DemoModule } from './types';

export function kebab(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function validate(mod: unknown): { ok: true; demo: DemoModule } | { ok: false; error: string } {
  const m = mod as Partial<DemoModule> | null;
  if (!m || typeof m !== 'object') return { ok: false, error: 'module is not an object' };
  if (!Array.isArray(m.states) || m.states.length === 0) {
    return { ok: false, error: 'missing non-empty states[]' };
  }
  if (!m.meta || typeof m.meta.title !== 'string' || typeof m.meta.group !== 'string') {
    return { ok: false, error: 'missing meta { title, group }' };
  }
  for (const s of m.states) {
    if (typeof s?.name !== 'string' || typeof s?.render !== 'function') {
      return { ok: false, error: 'each state needs { name: string, render: () => ReactNode }' };
    }
  }
  return { ok: true, demo: m as DemoModule };
}

function compare(a: CollectedDemo, b: CollectedDemo): number {
  if ('error' in a || 'error' in b) {
    if ('error' in a && 'error' in b) return a.path.localeCompare(b.path);
    return 'error' in a ? 1 : -1;
  }
  const g = a.meta.group.localeCompare(b.meta.group);
  if (g !== 0) return g;
  const ao = a.meta.order ?? Number.MAX_SAFE_INTEGER;
  const bo = b.meta.order ?? Number.MAX_SAFE_INTEGER;
  if (ao !== bo) return ao - bo;
  return a.meta.title.localeCompare(b.meta.title);
}

// Re-sort a merged list (e.g. package demos + app demos in the web route).
export function sortDemos(demos: CollectedDemo[]): CollectedDemo[] {
  return [...demos].sort(compare);
}

export function collectDemos(glob: Record<string, unknown>): CollectedDemo[] {
  const collected: CollectedDemo[] = Object.entries(glob).map(([path, mod]) => {
    const v = validate(mod);
    if (!v.ok) return { path, error: v.error };
    const slug = kebab(v.demo.meta.title);
    return {
      slug,
      meta: v.demo.meta,
      states: v.demo.states.map((s) => ({ ...s, slug: `${slug}--${kebab(s.name)}` })),
    };
  });
  return sortDemos(collected);
}
