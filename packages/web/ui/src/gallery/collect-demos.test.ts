import { collectDemos, kebab } from './collect-demos';
import { isDemoError } from './types';

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
