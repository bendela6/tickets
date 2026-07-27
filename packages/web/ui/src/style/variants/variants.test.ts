import { describe, expect, it } from 'vitest';
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

  const badgeClass = variants({
    base: 'font-600',
    config: {
      variant: {
        default: 'soft',
        params: { tone: { default: 'base', values: ['red', 'blue'] } },
        options: ({ tone }: { tone?: string }) => {
          return {
            soft: [`bg-${tone}-100 text-${tone}-800`, `dark:bg-${tone}-900`],
            ghost: `text-${tone}-700`,
          };
        },
      },
      size: {
        default: 'md',
        options: { sm: 'text-xs', md: 'text-base' },
      },
    },
  });

  it('passes params into function groups at render time', () => {
    expect(badgeClass({ tone: 'red', variant: 'soft' })).toBe(
      'font-600 bg-red-100 text-red-800 dark:bg-red-900 text-base',
    );
  });

  it('enumerates every class across options and param values', () => {
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

  it('exposes axes: group option names (static + function) and param domains', () => {
    expect(badgeClass.axes).toEqual({
      groups: { variant: ['soft', 'ghost'], size: ['sm', 'md'] },
      params: { tone: ['red', 'blue'] },
    });
  });

  it('exposes empty params when none are configured', () => {
    expect(buttonClass.axes).toEqual({
      groups: { intent: ['primary', 'ghost'], size: ['sm', 'md'] },
      params: {},
    });
  });

  // The safelist is only as good as this cross-product: a class like
  // `hover:bg-red-9/40` exists nowhere in source, so if enumeration misses a
  // param combination Tailwind never emits the utility and the state renders
  // unstyled. Numeric domains are the case to watch — they interpolate the same
  // as strings but arrive as numbers.
  const alphaClass = variants({
    base: 'rounded-sm',
    config: {
      emphasis: {
        default: 'solid',
        params: {
          tone: { default: 'red', values: ['red', 'blue'] },
          alpha: { default: 40, values: [40, 60] },
        },
        options: ({ tone, alpha }: { tone?: string; alpha?: number }) => ({
          solid: `bg-${tone}-9 hover:bg-${tone}-10/${alpha}`,
          soft: `bg-${tone}-3/${alpha}`,
        }),
      },
    },
  });

  it('enumerates the full cross-product of several params, including numeric ones', () => {
    expect(new Set(alphaClass.classes)).toEqual(
      new Set([
        'rounded-sm',
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

  it('renders a numeric param without stringifying it differently', () => {
    expect(alphaClass({ tone: 'blue', alpha: 60 })).toBe('rounded-sm bg-blue-9 hover:bg-blue-10/60');
  });

  it('reports a numeric domain as strings in axes', () => {
    expect(alphaClass.axes.params).toEqual({ tone: ['red', 'blue'], alpha: ['40', '60'] });
  });

  const escapeHatchClass = variants({
    base: 'block',
    config: { size: { default: 'md', options: { md: 'h-9' } } },
    safelist: ['bg-teal-9/[0.55]', 'dark:ring-teal-7'],
  });

  it('folds a declared safelist into the enumeration without applying it', () => {
    expect(escapeHatchClass()).toBe('block h-9');
    expect(new Set(escapeHatchClass.classes)).toEqual(
      new Set(['block', 'h-9', 'bg-teal-9/[0.55]', 'dark:ring-teal-7']),
    );
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
