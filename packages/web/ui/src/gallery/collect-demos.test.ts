import { collectDemos, kebab, prepareDemos } from './collect-demos';
import { isDemoError } from './types';
import { boolean as booleanControl, definePlayground } from './controls';

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

describe('CollectedDemo path field', () => {
  it('exposes the glob key as path on success entries', () => {
    const out = collectDemos({ './x/button.demo.tsx': { meta: { title: 'Button', group: 'G' }, states: [{ name: 's', render: () => null }] } });
    const d = out[0]!;
    if (isDemoError(d)) throw new Error(d.error);
    expect(d.path).toBe('./x/button.demo.tsx');
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
