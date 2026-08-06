import { isDefinedState } from './states';
import {
  DEMO_SIZES,
  type AnyDemoState,
  type CollectedDemo,
  type CollectedState,
  type DemoMeta,
  type DemoModule,
  type DemoSize,
} from './types';

export function kebab(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Which group a demo belongs to, read off its path.
 *
 * The group used to be hand-typed in `meta.group`, which let the sidebar
 * disagree with the tree — and produced an `Ungrouped` bucket holding seven
 * demos that simply never got a category. The directory is now the only source
 * of truth, so a demo cannot be filed wrong without being *moved* wrong.
 *
 * Both maps arrive rebased onto workspace-relative roots (see rebaseGlobKeys),
 * which is what lets one function serve the package's demos and the app's.
 * `docs/pages/` gets a fixed label rather than a title-cased segment: those six
 * pages document the design system itself (type scale, radius, elevation, ...)
 * rather than a `library/` group, so there is no directory name to read.
 *
 * Returns null rather than a fallback group: a silent default is exactly how
 * `Ungrouped` grew, so an unrecognised path becomes a visible error card.
 */
export function groupFromPath(path: string): string | null {
  const lib = path.match(/(?:^|\/)packages\/web\/ui\/src\/library\/([^/]+)\//);
  // Non-null: the capture group is `[^/]+`, never optional — if `lib` matched
  // at all, group 1 matched too. `noUncheckedIndexedAccess` can't see that.
  if (lib) return lib[1]!.replace(/(^|-)(\w)/g, (_, sep, c) => (sep ? ' ' : '') + c.toUpperCase());
  if (/(?:^|\/)packages\/web\/ui\/src\/docs\/pages\//.test(path)) return 'Foundation';
  if (/(?:^|\/)apps\/web\/src\//.test(path)) return 'App';
  return null;
}

function validate(mod: unknown): { ok: true; demo: DemoModule } | { ok: false; error: string } {
  const m = mod as Partial<DemoModule> | null;
  if (!m || typeof m !== 'object') return { ok: false, error: 'module is not an object' };
  // A demo needs SOMETHING to show: either sections it authored or a playground
  // whose controls the axes can be derived from.
  if (m.states === undefined) {
    if (!m.playground) return { ok: false, error: 'needs states[] or a playground' };
  } else if (!Array.isArray(m.states) || m.states.length === 0) {
    return { ok: false, error: 'missing non-empty states[]' };
  }
  if (!m.meta || typeof m.meta.title !== 'string') {
    return { ok: false, error: 'missing meta { title }' };
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
  for (const s of m.states ?? []) {
    if (isDefinedState(s)) {
      if (typeof s.title !== 'string' || typeof s.render !== 'function') {
        return { ok: false, error: 'defineState needs { title: string, render: () => ReactNode }' };
      }
      continue;
    }
    if (typeof (s as { name?: unknown })?.name !== 'string' || typeof s?.render !== 'function') {
      return { ok: false, error: 'each state needs { name: string, render: () => ReactNode }' };
    }
  }
  // Half-migrated is worse than either end: the authored sections would win the
  // page and the leftover literals would render beside them with no layout and
  // no source. Make it a visible error rather than a confusing page.
  const defined = (m.states ?? []).filter(isDefinedState).length;
  if (defined > 0 && defined < (m.states ?? []).length) {
    return { ok: false, error: 'states[] mixes defineState() sections with plain literals' };
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

/**
 * Resolves a demo's group from its path and what it authored.
 *
 * The directory wins whenever it can answer (`groupFromPath` returns
 * non-null) — a resolvable path always yields its derived group, never the
 * authored one, so nothing can render under a group that disagrees with where
 * its file lives.
 *
 * Whether a *leftover* authored `meta.group` next to a resolvable path is an
 * ERROR, versus silently outvoted, is `strict`'s job — see `collectDemos`.
 * When the directory can't answer at all, an authored `meta.group` is
 * honoured unconditionally, `strict` or not: rejecting it would leave the
 * demo with no group under any mode, which is a worse failure than an
 * unenforced hand-typed one.
 */
function resolveGroup(
  path: string,
  meta: DemoMeta,
  strict: boolean,
): { ok: true; group: string } | { ok: false; error: string } {
  const authored = (meta as { group?: unknown }).group;
  const derived = groupFromPath(path);
  if (derived !== null) {
    if (strict && authored !== undefined) {
      return { ok: false, error: 'meta.group is derived from the directory — delete it' };
    }
    return { ok: true, group: derived };
  }
  if (typeof authored === 'string') {
    return { ok: true, group: authored };
  }
  return {
    ok: false,
    error: 'no group for this path — demos live under library/<group>/ or apps/web/src/',
  };
}

// `title` and `name` are the same field under two names — the authored form
// says title because that is what the card's header shows, the literal said
// name because it predates the card having one.
function collectState(state: AnyDemoState, demoSlug: string): CollectedState {
  const defined = isDefinedState(state);
  const name = defined ? state.title : state.name;
  return { name, render: state.render, slug: `${demoSlug}--${kebab(name)}`, defined };
}

/**
 * The sidebar reads top-down as an argument: what the system is made of, then
 * what is built from it — in the order most reached-for first — and last what
 * belongs to the app rather than the library. Alphabetical order would bury
 * Inputs among the others and scatter Foundation through the middle, so the
 * whole run is ranked explicitly instead.
 *
 * Foundation leads rather than being one of the eight `library/` groups:
 * `groupFromPath` returns it for the six `docs/pages/` demos that document the
 * design system itself (type scale, radius, elevation, ...), and "what the
 * system is made of" comes first in the argument above.
 *
 * A group this list has never heard of sorts after all of these — see
 * `groupRank` — rather than erroring, so an unrecognised *name* degrades to
 * last instead of vanishing. (An unrecognised *path* is a different failure,
 * handled earlier in `resolveGroup`, before a demo ever reaches this list.)
 *
 * Deprecated is no longer a group of its own: the old `TRAILING` array and its
 * `Ungrouped` bucket are gone, because both were symptoms of a hand-typed
 * field that could disagree with the directory. A deprecated demo keeps
 * whatever group its directory gives it and sorts last only *within* that
 * group — see `compare`.
 */
// `Inputs` sits early on purpose: the form controls are their own layer now —
// one directory, one contract, one size ladder — and they are what you reach
// for most. Burying them alphabetically among the other groups would hide the
// one that has the most to compare.
const GROUP_ORDER = [
  'Foundation', 'Primitives', 'Inputs', 'Forms', 'Table',
  'Layout', 'Navigation', 'Overlays', 'Feedback', 'App',
];

function groupRank(group: string): number {
  const explicit = GROUP_ORDER.indexOf(group);
  return explicit === -1 ? GROUP_ORDER.length : explicit;
}

function compare(a: CollectedDemo, b: CollectedDemo): number {
  if ('error' in a || 'error' in b) {
    if ('error' in a && 'error' in b) return a.path.localeCompare(b.path);
    return 'error' in a ? 1 : -1;
  }
  const g = groupRank(a.meta.group) - groupRank(b.meta.group);
  if (g !== 0) return g;
  const same = a.meta.group.localeCompare(b.meta.group);
  if (same !== 0) return same;
  // Deprecated sorts last within its own group instead of forming a group of
  // its own — see the comment above GROUP_ORDER. Returning a signed 0/1 delta
  // rather than an early `return -1`/`1` keeps this a normal comparator term:
  // two demos that agree on deprecation (both set, or neither) fall through
  // to order/title exactly like any other tie.
  const ad = a.meta.deprecated ? 1 : 0;
  const bd = b.meta.deprecated ? 1 : 0;
  if (ad !== bd) return ad - bd;
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

/**
 * `rebaseGlobKeys`, generalised for a globbing module that does not sit
 * exactly one directory below `root` — every one of this package's
 * `docs/gallery/*.ts` glob sites, which sit at `docs/gallery/`, two below
 * `src/`. Stripping a single leading `../` and prepending root (what
 * `rebaseGlobKeys` does) assumes every match is reached the same number of
 * `../` up — true for apps/web's gallery route, whose globbing module has no
 * sibling that shares a path prefix with any match. It is false here:
 * `import.meta.glob` reports the SHORTEST relative specifier per match, so a
 * `docs/pages/*` file (one `../`, via the shared `docs/` parent) and a
 * `library/**` file (two `../`, no shared parent) arrive at different depths
 * from the same glob call. `groupFromPath` never saw this before Task 10 —
 * nothing had ever parsed a demo's path for meaning — so a single-strip
 * rebase silently produced a `/../`-polluted path for `library/**` and a
 * path missing its `docs/` segment for `docs/pages/*`; both still LOOKED like
 * a path and were harmless when nothing read their segments.
 *
 * `moduleDir` is the globbing module's own directory, expressed the same way
 * as `root` (workspace-relative, e.g. `${UI_SRC_ROOT}/docs/gallery`). Each key
 * is resolved against it with ordinary `..`-segment semantics, which is
 * correct at any depth or shared-prefix — the general case `rebaseGlobKeys`
 * only handles a special case of.
 */
export function rebaseNestedGlobKeys<T>(moduleDir: string, glob: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(glob).map(([key, value]) => {
      const out = moduleDir.split('/');
      for (const seg of key.split('/')) {
        if (seg === '' || seg === '.') continue;
        if (seg === '..') out.pop();
        else out.push(seg);
      }
      return [out.join('/'), value];
    }),
  );
}

export interface CollectDemosOptions {
  /**
   * Turns a leftover authored `meta.group` next to a *resolvable* path from
   * a silent loss (the directory wins anyway) into a hard error. Defaults to
   * off, because `collectDemos` has one caller inside this package that needs
   * it on — `demos.ts`, which is what Step 8 of the group-derivation work (68
   * hand-edited demo files) is checked against — and several outside it that
   * would break if it were on unconditionally.
   *
   * Specifically: eight test files across `@tickets/playground` (including
   * its sidebar and command-palette specs) call this function directly with
   * `meta: { title, group }` literals, several against keys built to look
   * like real app paths (`apps/web/src/ui/button.demo.tsx`) that
   * `groupFromPath` legitimately resolves. Defaulting to strict would reject
   * every one of them, and fixing
   * that would mean editing files this task's design explicitly rules out
   * touching. Off by default keeps every existing caller working exactly as
   * it did before Step 6 moved `group` off of what a demo authors; on is an
   * opt-in for the one place a stale `group` should be loud rather than
   * quietly outvoted.
   */
  strictGroup?: boolean;
}

export function collectDemos(
  glob: Record<string, unknown>,
  { strictGroup = false }: CollectDemosOptions = {},
): CollectedDemo[] {
  const collected: CollectedDemo[] = Object.entries(glob).map(([path, mod]) => {
    const v = validate(mod);
    if (!v.ok) return { path, error: v.error };
    const g = resolveGroup(path, v.demo.meta, strictGroup);
    if (!g.ok) return { path, error: g.error };
    const slug = kebab(v.demo.meta.title);
    return {
      path,
      slug,
      meta: { ...v.demo.meta, group: g.group },
      states: (v.demo.states ?? []).map((s) => collectState(s, slug)),
      playground: v.demo.playground,
    };
  });
  return prepareDemos(collected);
}
