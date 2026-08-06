import { expectTypeOf } from 'vitest';
import { boolean, definePlayground, initialValues, number, select, text } from './controls';

describe('control constructors', () => {
  it('select defaults: initial=first option, allowNone=false', () => {
    const d = select(['a', 'b']);
    expect(d).toEqual({ kind: 'select', options: ['a', 'b'], initial: 'a', allowNone: false, label: undefined });
  });

  it('select with allowNone and no initial starts unset', () => {
    const d = select(['a', 'b'], { allowNone: true });
    expect(d.initial).toBeUndefined();
  });

  it('boolean/text/number defaults', () => {
    expect(boolean()).toEqual({ kind: 'boolean', initial: false, label: undefined });
    expect(text()).toEqual({ kind: 'text', initial: '', placeholder: '', label: undefined });
    expect(number()).toEqual({ kind: 'number', initial: 0, step: 1, min: undefined, max: undefined, allowNone: false, label: undefined });
  });

  it('an allowNone number control can hold, and default to, no value', () => {
    // A NumberInput's own min/max are optional, so a playground that cannot
    // express "unset" cannot show the component in its default state.
    expect(number(undefined, { allowNone: true }).initial).toBeUndefined();
    expect(number(undefined, { allowNone: true }).allowNone).toBe(true);
    // A plain control still falls back to 0 rather than carrying undefined.
    expect(number(undefined).initial).toBe(0);
  });

  it('initialValues maps defs to their initial values', () => {
    const values = initialValues({
      variant: select(['primary', 'secondary'], { initial: 'secondary' }),
      size: select(['sm', 'md'], { allowNone: true }),
      loading: boolean(true),
      label: text('hi'),
      count: number(3),
    });
    expect(values).toEqual({ variant: 'secondary', size: undefined, loading: true, label: 'hi', count: 3 });
  });

  it('definePlayground is identity and render values are inferred', () => {
    const p = definePlayground({
      controls: {
        variant: select(['primary', 'secondary']),
        size: select(['sm', 'md'], { allowNone: true }),
        loading: boolean(),
        children: text('x'),
        max: number(1),
      },
      render: (v) => {
        expectTypeOf(v.variant).toEqualTypeOf<'primary' | 'secondary'>();
        expectTypeOf(v.size).toEqualTypeOf<'sm' | 'md' | undefined>();
        expectTypeOf(v.loading).toEqualTypeOf<boolean>();
        expectTypeOf(v.children).toEqualTypeOf<string>();
        expectTypeOf(v.max).toEqualTypeOf<number>();
        return null;
      },
    });
    expect(typeof p.render).toBe('function');
    expect(p.render(initialValues(p.controls))).toBeNull();
  });
});
