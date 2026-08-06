import {
  collectDemos,
  groupFromPath,
  kebab,
  prepareDemos,
  rebaseGlobKeys,
  rebaseNestedGlobKeys,
} from './collect-demos';
import { isDemoError } from './types';
import { UI_SRC_ROOT, WEB_SRC_ROOT } from './roots';
import { boolean as booleanControl, definePlayground } from './controls';
import { defineState } from './states';

describe('groupFromPath', () => {
  it('reads the group out of a library path', () => {
    expect(groupFromPath('packages/web/ui/src/library/primitives/components/pill/pill.demo.tsx'))
      .toBe('Primitives');
    expect(groupFromPath('packages/web/ui/src/library/inputs/components/select/select.demo.tsx'))
      .toBe('Inputs');
  });

  it('reads a group whose demo sits at the group root, not under components/', () => {
    expect(groupFromPath('packages/web/ui/src/library/inputs/inputs.demo.tsx')).toBe('Inputs');
    expect(groupFromPath('packages/web/ui/src/library/table/table.demo.tsx')).toBe('Table');
  });

  it('calls the app its own group', () => {
    expect(groupFromPath('apps/web/src/components/ai/message-stream.demo.tsx')).toBe('App');
  });

  it('refuses to guess', () => {
    expect(groupFromPath('packages/web/ui/src/style/cn/cn.demo.tsx')).toBeNull();
    expect(groupFromPath('somewhere/else/x.demo.tsx')).toBeNull();
  });

  // Not one of the eight library groups: these six pages document the design
  // system itself (type scale, radius, elevation, ...), so they get a fixed
  // label instead of a title-cased directory segment.
  it('reads Foundation for a docs/pages path', () => {
    expect(groupFromPath('packages/web/ui/src/docs/pages/typography/typography.demo.tsx'))
      .toBe('Foundation');
    expect(groupFromPath('packages/web/ui/src/docs/pages/colors/colors.demo.tsx'))
      .toBe('Foundation');
  });
});

const good = (title: string, group: string, order?: number) => ({
  meta: { title, group, order },
  states: [{ name: 'Default state', render: () => null }],
});

describe('kebab', () => {
  it('lowercases and collapses non-alphanumerics', () => {
    expect(kebab('Status badges — shape-coded')).toBe('status-badges-shape-coded');
    expect(kebab('Button')).toBe('button');
  });
});

describe('collectDemos', () => {
  it('collects valid modules with demo and state slugs', () => {
    const out = collectDemos({ './button.demo.tsx': good('Button', 'Form controls') });
    expect(out).toHaveLength(1);
    const d = out[0]!;
    if (isDemoError(d)) throw new Error(d.error);
    expect(d.slug).toBe('button');
    expect(d.states[0]!.slug).toBe('button--default-state');
  });

  it('sorts by group, then order (unset last), then title', () => {
    const out = collectDemos({
      'a': good('Zeta', 'Form controls'),
      'b': good('Alpha', 'Form controls', 2),
      'c': good('Beta', 'Form controls', 1),
      'd': good('Anything', 'Display'),
    });
    const titles = out.map((d) => (isDemoError(d) ? '!' : d.meta.title));
    expect(titles).toEqual(['Anything', 'Beta', 'Alpha', 'Zeta']);
  });

  it('turns malformed modules into error entries instead of throwing', () => {
    const out = collectDemos({
      './broken.demo.tsx': { meta: { title: 'X' } },              // no states
      './worse.demo.tsx': { meta: { title: 'Y', group: 'G' }, states: [{ name: 'a', render: 'nope' }] },
      './fine.demo.tsx': good('Fine', 'Display'),
    });
    const errors = out.filter(isDemoError);
    expect(errors).toHaveLength(2);
    expect(errors[0]!.path).toBe('./broken.demo.tsx');
    expect(errors[0]!.error).toMatch(/states/);
    expect(out.filter((d) => !isDemoError(d))).toHaveLength(1);
  });

  it('tiebreaks by title when group and order are equal', () => {
    const out = collectDemos({
      'a': { meta: { title: 'Zeta', group: 'G' }, states: [{ name: 's', render: () => null }] },
      'b': { meta: { title: 'Alpha', group: 'G' }, states: [{ name: 's', render: () => null }] },
    });
    const titles = out.map((d) => (isDemoError(d) ? '!' : d.meta.title));
    expect(titles).toEqual(['Alpha', 'Zeta']);
  });

  it('orders multiple error entries deterministically by path', () => {
    const out = collectDemos({
      './z.demo.tsx': { meta: { title: 'Z' } },
      './a.demo.tsx': { meta: { title: 'A' } },
    });
    expect(out.map((d) => (isDemoError(d) ? d.path : '!'))).toEqual(['./a.demo.tsx', './z.demo.tsx']);
  });
});

describe('authored states', () => {
  const pg = () => definePlayground({ controls: { on: booleanControl() }, render: () => null });

  it('normalises a defineState title into the same name and slug a literal gets', () => {
    const out = collectDemos({
      'a': {
        meta: { title: 'Button', group: 'G' },
        states: [defineState({ title: 'icon only', render: () => null })],
      },
    });
    const d = out[0]!;
    if (isDemoError(d)) throw new Error(d.error);
    expect(d.states[0]).toMatchObject({ name: 'icon only', slug: 'button--icon-only', defined: true });
  });

  it('marks a plain literal as not authored', () => {
    const out = collectDemos({ 'a': good('Button', 'G') });
    const d = out[0]!;
    if (isDemoError(d)) throw new Error(d.error);
    expect(d.states[0]!.defined).toBe(false);
  });

  it('rejects a half-migrated array', () => {
    // Both halves would render, the authored ones winning the page and the
    // literals sitting beside them with no layout and no source. An error is
    // more useful than that page.
    const out = collectDemos({
      'a': {
        meta: { title: 'Button', group: 'G' },
        states: [defineState({ title: 'new', render: () => null }), { name: 'old', render: () => null }],
      },
    });
    expect(out.filter(isDemoError)[0]!.error).toMatch(/mixes/);
  });

  it('lets a demo with a playground omit states entirely', () => {
    // The derived axes are the page in that case, so an empty states[] would
    // be dead weight kept alive only to satisfy the validator.
    const out = collectDemos({ 'a': { meta: { title: 'B', group: 'G' }, playground: pg() } });
    const d = out[0]!;
    if (isDemoError(d)) throw new Error(d.error);
    expect(d.states).toEqual([]);
  });

  it('still requires a demo with no playground to author something', () => {
    const out = collectDemos({ 'a': { meta: { title: 'B', group: 'G' } } });
    expect(out.filter(isDemoError)[0]!.error).toMatch(/states\[\] or a playground/);
  });
});

describe('playground validation', () => {
  const base = { meta: { title: 'B', group: 'G' }, states: [{ name: 's', render: () => null }] };

  it('carries a valid playground through', () => {
    const pg = definePlayground({ controls: { on: booleanControl() }, render: () => null });
    const out = collectDemos({ 'a': { ...base, playground: pg } });
    const d = out[0]!;
    if (isDemoError(d)) throw new Error(d.error);
    expect(d.playground).toBe(pg);
  });

  it('rejects a malformed playground as an error entry', () => {
    const out = collectDemos({ 'a': { ...base, playground: { controls: { bad: { kind: 'nope' } }, render: () => null } } });
    expect(isDemoError(out[0]!)).toBe(true);
    if (isDemoError(out[0]!)) expect(out[0]!.error).toMatch(/playground/);
  });

  it('demo without playground is still fine', () => {
    const out = collectDemos({ 'a': base });
    const d = out[0]!;
    if (isDemoError(d)) throw new Error(d.error);
    expect(d.playground).toBeUndefined();
  });
});

describe('prepareDemos duplicate-slug guard', () => {
  it('turns a repeated slug into an error entry, keeping the first', () => {
    const a = collectDemos({ 'x': { meta: { title: 'Button', group: 'G' }, states: [{ name: 's', render: () => null }] } });
    const b = collectDemos({ 'y': { meta: { title: 'Button', group: 'G' }, states: [{ name: 's', render: () => null }] } });
    const out = prepareDemos([...a, ...b]);
    expect(out.filter(isDemoError)).toHaveLength(1);
    expect(out.filter((d) => !isDemoError(d))).toHaveLength(1);
    const err = out.find(isDemoError)!;
    expect(err.error).toMatch(/duplicate demo slug "button"/);
    expect(err.path).toMatch(/^#button@\d+$/);
  });

  it('gives each extra duplicate a distinct error path', () => {
    const mk = (k: string) => collectDemos({ [k]: { meta: { title: 'Button', group: 'G' }, states: [{ name: 's', render: () => null }] } });
    const out = prepareDemos([...mk('a'), ...mk('b'), ...mk('c')]);
    const errs = out.filter(isDemoError);
    expect(errs).toHaveLength(2);
    expect(new Set(errs.map((e) => e.path)).size).toBe(2);
  });
});

describe('rebaseGlobKeys', () => {
  it('strips the leading `../` and prefixes the workspace root', () => {
    const keys = { '../components/pill/pill.tsx': 1, '../components/icon/icon.tsx': 2 };
    expect(rebaseGlobKeys(UI_SRC_ROOT, keys)).toEqual({
      'packages/web/ui/src/components/pill/pill.tsx': 1,
      'packages/web/ui/src/components/icon/icon.tsx': 2,
    });
  });

  it('keeps two packages from shadowing each other when the maps merge', () => {
    // Both globs produce the key `../app.tsx` from *different* directories.
    // Un-rebased, the merge silently drops one; rebased, both survive.
    const ui = { '../app.tsx': 'ui-file' };
    const web = { '../app.tsx': 'web-file' };
    expect(Object.keys({ ...ui, ...web })).toHaveLength(1);
    const merged = {
      ...rebaseGlobKeys(UI_SRC_ROOT, ui),
      ...rebaseGlobKeys(WEB_SRC_ROOT, web),
    };
    expect(merged['packages/web/ui/src/app.tsx']).toBe('ui-file');
    expect(merged['apps/web/src/app.tsx']).toBe('web-file');
  });
});

describe('rebaseNestedGlobKeys', () => {
  // docs/gallery/demos.ts sits two directories below src/, so its raw glob
  // keys arrive at two different `../` depths from a single glob call: one
  // for a docs/pages/* sibling (reached via the shared docs/ parent), two for
  // anything under library/ (no shared parent). rebaseGlobKeys assumes every
  // key is the same depth and gets the pages case wrong (see collect-demos.ts
  // for the concrete before/after); this is the fix, proven against both
  // depths from the very moduleDir demos.ts actually has.
  it('resolves keys at different `../` depths against the same module directory', () => {
    const moduleDir = `${UI_SRC_ROOT}/docs/gallery`;
    const glob = {
      '../pages/typography/typography.demo.tsx': 'pages-file',
      '../../library/primitives/components/pill/pill.demo.tsx': 'library-file',
      './collect-demos.ts': 'sibling-file',
    };
    expect(rebaseNestedGlobKeys(moduleDir, glob)).toEqual({
      [`${UI_SRC_ROOT}/docs/pages/typography/typography.demo.tsx`]: 'pages-file',
      [`${UI_SRC_ROOT}/library/primitives/components/pill/pill.demo.tsx`]: 'library-file',
      [`${UI_SRC_ROOT}/docs/gallery/collect-demos.ts`]: 'sibling-file',
    });
  });

  it('agrees with rebaseGlobKeys for a module that really does sit one level below root', () => {
    // rebaseGlobKeys(root, glob) assumes the globbing module sits exactly one
    // directory below `root` — apps/web's gallery route, for instance. That is
    // the same claim as rebaseNestedGlobKeys(`${root}/anyChild`, glob), so the
    // two must agree whenever that assumption actually holds.
    const glob = { '../components/pill/pill.tsx': 1 };
    expect(rebaseNestedGlobKeys(`${UI_SRC_ROOT}/anyChild`, glob)).toEqual(rebaseGlobKeys(UI_SRC_ROOT, glob));
  });
});

describe('meta.size and meta.impl validation', () => {
  const base = { states: [{ name: 's', render: () => null }] };

  it('carries a valid size and impl through', () => {
    const out = collectDemos({
      a: { ...base, meta: { title: 'B', group: 'G', size: 'full', impl: ['./a.tsx', './b.tsx'] } },
    });
    const d = out[0]!;
    if (isDemoError(d)) throw new Error(d.error);
    expect(d.meta.size).toBe('full');
    expect(d.meta.impl).toEqual(['./a.tsx', './b.tsx']);
  });

  it('rejects an unknown size instead of silently falling back', () => {
    const out = collectDemos({ a: { ...base, meta: { title: 'B', group: 'G', size: 'huge' } } });
    expect(isDemoError(out[0]!)).toBe(true);
    if (isDemoError(out[0]!)) expect(out[0]!.error).toMatch(/meta\.size/);
  });

  it('rejects an empty or non-string impl', () => {
    for (const impl of [[], '', [123]]) {
      const out = collectDemos({ a: { ...base, meta: { title: 'B', group: 'G', impl } } });
      expect(isDemoError(out[0]!)).toBe(true);
      if (isDemoError(out[0]!)) expect(out[0]!.error).toMatch(/meta\.impl/);
    }
  });
});

describe('CollectedDemo path field', () => {
  it('exposes the glob key as path on success entries', () => {
    const out = collectDemos({ './x/button.demo.tsx': { meta: { title: 'Button', group: 'G' }, states: [{ name: 's', render: () => null }] } });
    const d = out[0]!;
    if (isDemoError(d)) throw new Error(d.error);
    expect(d.path).toBe('./x/button.demo.tsx');
  });

  it('rebased demo paths still align with a sources map rebased the same way', () => {
    const glob = { '../button.demo.tsx': { meta: { title: 'Button', group: 'G' }, states: [{ name: 's', render: () => null }] } };
    const demos = collectDemos(rebaseGlobKeys(UI_SRC_ROOT, glob));
    const sources = rebaseGlobKeys(UI_SRC_ROOT, { '../button.demo.tsx': 'src' });
    const d = demos[0]!;
    if (isDemoError(d)) throw new Error(d.error);
    expect(d.path).toBe('packages/web/ui/src/button.demo.tsx');
    expect(sources[d.path]).toBe('src');
  });

  it('demo paths align with a sources map sharing the same glob keys', () => {
    const key = './button.demo.tsx';
    const demos = collectDemos({ [key]: { meta: { title: 'Button', group: 'G' }, states: [{ name: 's', render: () => null }] } });
    const sources: Record<string, string> = { [key]: 'export const meta = …' };
    const d = demos[0]!;
    if (isDemoError(d)) throw new Error(d.error);
    expect(sources[d.path]).toBe('export const meta = …');
  });
});

// Hazard: a demo living somewhere the directory already resolves must not
// let a hand-typed meta.group win — that would defeat the whole point of
// deriving it. Whether disagreement is a hard error or a silent overrule is
// `strictGroup`: off (the default) every existing caller of collectDemos
// keeps working exactly as before Step 6 moved `group` off of what a demo
// authors — including @tickets/playground's sidebar, command-palette and
// seven other test files, several of which build `meta: { title, group }`
// against paths real enough for groupFromPath to resolve. On is what
// packageDemos (demos.ts) opts into, because that's the pipeline Step 8 of
// this task (68 hand-edited demo files) needs to be loud about a leftover
// `group:` — see CollectDemosOptions's doc comment in collect-demos.ts.
describe('meta.group: derived where the directory can answer, authored where it cannot', () => {
  it('strictGroup rejects a stray meta.group on a path the directory already resolves', () => {
    const out = collectDemos(
      {
        'packages/web/ui/src/library/table/components/x/x.demo.tsx': {
          meta: { title: 'X', group: 'Stale' },
          states: [{ name: 's', render: () => null }],
        },
      },
      { strictGroup: true },
    );
    expect(isDemoError(out[0]!)).toBe(true);
    if (isDemoError(out[0]!)) expect(out[0]!.error).toBe('meta.group is derived from the directory — delete it');
  });

  it('without strictGroup, the directory silently outvotes a stray meta.group instead of erroring', () => {
    // This is the exact shape several @tickets/playground test fixtures use:
    // a real-enough path plus a leftover authored group. Proving it succeeds
    // — and that the directory's answer wins, not the authored one — is what
    // keeps those files working with zero edits.
    const out = collectDemos({
      'apps/web/src/ui/button.demo.tsx': {
        meta: { title: 'X', group: 'Stale' },
        states: [{ name: 's', render: () => null }],
      },
    });
    const d = out[0]!;
    if (isDemoError(d)) throw new Error(d.error);
    expect(d.meta.group).toBe('App');
  });

  it('derives the group from the directory when meta omits it', () => {
    const out = collectDemos({
      'packages/web/ui/src/library/table/components/x/x.demo.tsx': {
        meta: { title: 'X' },
        states: [{ name: 's', render: () => null }],
      },
    });
    const d = out[0]!;
    if (isDemoError(d)) throw new Error(d.error);
    expect(d.meta.group).toBe('Table');
  });

  it('honours an authored group when the path resolves to nothing', () => {
    const out = collectDemos({
      'nowhere/x.demo.tsx': {
        meta: { title: 'X', group: 'Whatever the caller says' },
        states: [{ name: 's', render: () => null }],
      },
    });
    const d = out[0]!;
    if (isDemoError(d)) throw new Error(d.error);
    expect(d.meta.group).toBe('Whatever the caller says');
  });

  it('errors when neither the path nor meta gives a group', () => {
    const out = collectDemos({
      'nowhere/x.demo.tsx': { meta: { title: 'X' }, states: [{ name: 's', render: () => null }] },
    });
    expect(isDemoError(out[0]!)).toBe(true);
    if (isDemoError(out[0]!)) {
      expect(out[0]!.error).toBe(
        'no group for this path — demos live under library/<group>/ or apps/web/src/',
      );
    }
  });
});

// Hazard: `compare` sorts by group, and a comparator that returns 0 where it
// means -1 fails silently — the list would look unsorted but no test would
// say why. Alpha/Zulu are chosen so alphabetical order would put the
// deprecated one FIRST; only the deprecated-tiebreak moving it to last proves
// the comparator term actually executes.
describe('compare: deprecated sorts last within its group', () => {
  it('sorts a deprecated demo after its non-deprecated groupmate even though its title sorts first', () => {
    const out = collectDemos({
      'packages/web/ui/src/library/table/components/alpha/alpha.demo.tsx': {
        meta: { title: 'Alpha', deprecated: true },
        states: [{ name: 's', render: () => null }],
      },
      'packages/web/ui/src/library/table/components/zulu/zulu.demo.tsx': {
        meta: { title: 'Zulu' },
        states: [{ name: 's', render: () => null }],
      },
    });
    const titles = out.map((d) => (isDemoError(d) ? '!' : d.meta.title));
    expect(titles).toEqual(['Zulu', 'Alpha']);
  });

  it('does not let deprecation cross group boundaries', () => {
    // A deprecated Inputs demo must still rank ahead of a non-deprecated Table
    // demo — deprecated only breaks a tie WITHIN a group, it is not a second,
    // lower-priority group ranking underneath GROUP_ORDER.
    const out = collectDemos({
      'packages/web/ui/src/library/inputs/components/old/old.demo.tsx': {
        meta: { title: 'Old', deprecated: true },
        states: [{ name: 's', render: () => null }],
      },
      'packages/web/ui/src/library/table/components/new/new.demo.tsx': {
        meta: { title: 'New' },
        states: [{ name: 's', render: () => null }],
      },
    });
    const titles = out.map((d) => (isDemoError(d) ? '!' : d.meta.title));
    expect(titles).toEqual(['Old', 'New']);
  });
});
