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
    expect(number()).toEqual({ kind: 'number', initial: 0, step: 1, min: undefined, max: undefined, label: undefined });
  });

  it('initialValues maps defs to their initial values', () => {
    const values = initialValues({
      variant: select(['primary', 'secondary'], { initial: 'secondary' }),
      size: select(['compact', 'regular'], { allowNone: true }),
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
        size: select(['compact', 'regular'], { allowNone: true }),
        loading: boolean(),
        children: text('x'),
        max: number(1),
      },
      render: (v) => {
        expectTypeOf(v.variant).toEqualTypeOf<'primary' | 'secondary'>();
        expectTypeOf(v.size).toEqualTypeOf<'compact' | 'regular' | undefined>();
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
