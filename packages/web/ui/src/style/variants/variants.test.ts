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
