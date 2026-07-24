import { DEMO_SIZES, type CollectedDemo, type DemoModule, type DemoSize } from './types';

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
  const { size, impl } = m.meta;
  if (size !== undefined && !DEMO_SIZES.includes(size as DemoSize)) {
    return { ok: false, error: `meta.size must be one of ${DEMO_SIZES.join(' | ')}` };
  }
  if (impl !== undefined) {
    const paths = Array.isArray(impl) ? impl : [impl];
    if (paths.length === 0 || paths.some((p) => typeof p !== 'string' || p === '')) {
      return { ok: false, error: 'meta.impl must be a non-empty path or array of paths' };
    }
  }
  for (const s of m.states) {
    if (typeof s?.name !== 'string' || typeof s?.render !== 'function') {
      return { ok: false, error: 'each state needs { name: string, render: () => ReactNode }' };
    }
  }
  if (m.playground !== undefined) {
    const p = m.playground as Partial<import('./controls').AnyPlayground> | null;
    if (!p || typeof p !== 'object' || typeof p.render !== 'function' || !p.controls || typeof p.controls !== 'object') {
      return { ok: false, error: 'playground must be { controls, render }' };
    }
    for (const def of Object.values(p.controls)) {
      const kind = (def as { kind?: unknown })?.kind;
      if (kind !== 'select' && kind !== 'boolean' && kind !== 'text' && kind !== 'number') {
        return { ok: false, error: `playground control has unknown kind "${String(kind)}"` };
      }
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

// Guard a (possibly merged) list against slug collisions, then sort. A later
// duplicate would double-render with colliding DOM ids and React keys — turn
// it into an error card instead.
export function prepareDemos(demos: CollectedDemo[]): CollectedDemo[] {
  const seen = new Set<string>();
  const guarded = demos.map((d, i) => {
    if ('error' in d) return d;
    if (seen.has(d.slug)) return { path: `#${d.slug}@${i}`, error: `duplicate demo slug "${d.slug}"` };
    seen.add(d.slug);
    return d;
  });
  return sortDemos(guarded);
}

// `import.meta.glob` keys are relative to the module that globbed them
// ("../pill.demo.tsx"), so two packages' maps share a key space they never
// agreed on — @tickets/ui's `../cn.ts` and apps/web's `../app.tsx` are both
// one level up from *different* directories, and merging the maps lets one
// shadow the other. Rebasing each onto its workspace-relative root makes
// every key unique, and readable while we're at it.
export function rebaseGlobKeys<T>(root: string, glob: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(glob).map(([key, value]) => [`${root}/${key.replace(/^\.\.\//, '')}`, value]),
  );
}

export function collectDemos(glob: Record<string, unknown>): CollectedDemo[] {
  const collected: CollectedDemo[] = Object.entries(glob).map(([path, mod]) => {
    const v = validate(mod);
    if (!v.ok) return { path, error: v.error };
    const slug = kebab(v.demo.meta.title);
    return {
      path,
      slug,
      meta: v.demo.meta,
      states: v.demo.states.map((s) => ({ ...s, slug: `${slug}--${kebab(s.name)}` })),
      playground: v.demo.playground,
    };
  });
  return prepareDemos(collected);
}
