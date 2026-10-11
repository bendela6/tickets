import { describe, expect, it } from 'vitest';
import { axis, over } from './axis';
import { collectSafelist, variants } from './variants';

describe('variants', () => {
  const buttonClass = variants({
    base: 'inline-flex',
    config: {
      intent: {
        default: 'primary',
        options: {
          primary: 'bg-indigo-500 text-white',
          ghost: 'bg-transparent text-slate-700',
        },
      },
      size: {
        default: 'md',
        options: { sm: 'text-xs', md: 'text-sm' },
      },
    },
  });

  it('applies base, defaults, and merges className last', () => {
    expect(buttonClass()).toBe('inline-flex bg-indigo-500 text-white text-sm');
    expect(buttonClass({ intent: 'ghost', className: 'w-full' })).toBe(
      'inline-flex bg-transparent text-slate-700 text-sm w-full',
    );
  });

  it('lets an explicit prop override a default, but ignores undefined', () => {
    expect(buttonClass({ size: 'sm' })).toBe('inline-flex bg-indigo-500 text-white text-xs');
    expect(buttonClass({ size: undefined })).toBe('inline-flex bg-indigo-500 text-white text-sm');
  });

  // These used to be written as a group declaring `params` and computing its
  // options from them. That form is gone — an axis carries its own name, domain
  // and resting value, so the group restates none of it — but the behaviour
  // under test is the same, which is why the expected class sets below did not
  // change when the form did.
  const TONE = axis('tone', ['red', 'blue'], 'red');

  const badgeClass = variants({
    base: 'font-600',
    config: {
      variant: {
        default: 'soft',
        options: {
          soft: over(TONE, (tone) => [`bg-${tone}-100 text-${tone}-800`, `dark:bg-${tone}-900`]),
          ghost: over(TONE, (tone) => `text-${tone}-700`),
        },
      },
      size: {
        default: 'md',
        options: { sm: 'text-xs', md: 'text-base' },
      },
    },
  });

  it('resolves an axis prop at render time', () => {
    expect(badgeClass({ tone: 'red', variant: 'soft' })).toBe(
      'font-600 bg-red-100 text-red-800 dark:bg-red-900 text-base',
    );
  });

  it('enumerates every class across options and the axis domain', () => {
    expect(new Set(badgeClass.classes)).toEqual(
      new Set([
        'font-600',
        'bg-red-100',
        'text-red-800',
        'dark:bg-red-900',
        'text-red-700',
        'bg-blue-100',
        'text-blue-800',
        'dark:bg-blue-900',
        'text-blue-700',
        'text-xs',
        'text-base',
      ]),
    );
  });

  it('exposes axes: each group’s option names and each axis’s domain', () => {
    expect(badgeClass.axes).toEqual({
      groups: { variant: ['soft', 'ghost'], size: ['sm', 'md'] },
      params: { tone: ['red', 'blue'] },
    });
  });

  it('exposes empty params when no option varies over anything', () => {
    expect(buttonClass.axes).toEqual({
      groups: { intent: ['primary', 'ghost'], size: ['sm', 'md'] },
      params: {},
    });
  });

  // The safelist is only as good as this cross-product: a class like
  // `hover:bg-red-10/40` exists nowhere in source, so if enumeration misses a
  // combination Tailwind never emits the utility and the state renders
  // unstyled. Two axes on one option is the case to watch — the walk has to be
  // the product, not the concatenation.
  const ALPHA = axis('alpha', ['40', '60'], '40');

  const alphaClass = variants({
    base: 'rounded-4',
    config: {
      emphasis: {
        default: 'solid',
        options: {
          solid: over(TONE, ALPHA, (tone, alpha) => `bg-${tone}-9 hover:bg-${tone}-10/${alpha}`),
          soft: over(TONE, ALPHA, (tone, alpha) => `bg-${tone}-3/${alpha}`),
        },
      },
    },
  });

  it('enumerates the full cross-product of two axes on one option', () => {
    expect(new Set(alphaClass.classes)).toEqual(
      new Set([
        'rounded-4',
        'bg-red-9',
        'bg-blue-9',
        'hover:bg-red-10/40',
        'hover:bg-red-10/60',
        'hover:bg-blue-10/40',
        'hover:bg-blue-10/60',
        'bg-red-3/40',
        'bg-red-3/60',
        'bg-blue-3/40',
        'bg-blue-3/60',
      ]),
    );
  });

  it('renders one cell of that product', () => {
    expect(alphaClass({ tone: 'blue', alpha: '60' })).toBe(
      'rounded-4 bg-blue-9 hover:bg-blue-10/60',
    );
  });

  it('reports both axis domains in axes', () => {
    expect(alphaClass.axes.params).toEqual({ tone: ['red', 'blue'], alpha: ['40', '60'] });
  });

  it('exposes collectSafelist() including every class produced across all variants() calls', () => {
    const safelist = new Set(collectSafelist());
    for (const className of [
      'bg-indigo-500',
      'text-white',
      'bg-transparent',
      'text-slate-700',
      'text-xs',
      'text-sm',
      'font-600',
      'bg-red-100',
      'text-red-800',
      'dark:bg-red-900',
      'text-red-700',
      'bg-blue-100',
      'text-blue-800',
      'dark:bg-blue-900',
      'text-blue-700',
      'text-base',
    ]) {
      expect(safelist.has(className)).toBe(true);
    }
  });
});
