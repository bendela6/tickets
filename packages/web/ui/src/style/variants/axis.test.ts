import { describe, expect, it } from 'vitest';
import { axis, isExpansion, over } from './axis';
import { variants } from './variants';

const SIZE = axis('size', ['sm', 'md', 'lg'], 'md');
const RAMP = axis('scale', { red: { solid: 'red-9' }, blue: { solid: 'blue-9' } }, 'blue');
const STATE = axis('state', ['on', 'off'], 'off');

describe('axis', () => {
  it('takes a list domain and hands the value straight to the callback', () => {
    expect(SIZE.keys).toEqual(['sm', 'md', 'lg']);
    expect(SIZE.resolve('sm')).toBe('sm');
  });

  it('takes a record domain and hands over the entry, not the key', () => {
    // This is what lets a tone axis pass a resolved ramp, so a call site says
    // `t.solid` instead of rebuilding it from the key and a STEP.
    expect(RAMP.keys).toEqual(['red', 'blue']);
    expect(RAMP.resolve('red')).toEqual({ solid: 'red-9' });
  });
});

describe('over', () => {
  it('resolves against the selection', () => {
    const expansion = over(RAMP, (t) => `bg-${t.solid}`);
    expect(isExpansion(expansion)).toBe(true);
    expect(expansion.at({ scale: 'red' })).toBe('bg-red-9');
  });

  it('falls back when the axis is unset or outside its own domain', () => {
    // A `scale` of `primary` is a tone name, not a ramp name. Indexing the
    // ramp table with it would produce `bg-undefined` rather than failing.
    const expansion = over(RAMP, (t) => `bg-${t.solid}`);
    expect(expansion.at({})).toBe('bg-blue-9');
    expect(expansion.at({ scale: 'primary' })).toBe('bg-blue-9');
  });

  it('builds each combination once and reuses it', () => {
    let built = 0;
    const expansion = over(RAMP, (t) => {
      built += 1;
      return `bg-${t.solid}`;
    });
    expansion.at({ scale: 'red' });
    expansion.at({ scale: 'red' });
    expansion.at({ scale: 'blue' });
    expect(built).toBe(2);
  });

  it('builds nothing until asked — the table is lazy, not eager', () => {
    let built = 0;
    over(RAMP, () => {
      built += 1;
      return '';
    });
    expect(built).toBe(0);
  });

  it('composes axes and walks their whole product for the safelist', () => {
    const expansion = over(RAMP, STATE, (t, state) => `bg-${t.solid} ${state}`);
    expect(expansion.at({ scale: 'red', state: 'on' })).toBe('bg-red-9 on');
    expect(expansion.every()).toEqual([
      'bg-red-9 on',
      'bg-red-9 off',
      'bg-blue-9 on',
      'bg-blue-9 off',
    ]);
  });
});

describe('variants with over()', () => {
  const klass = variants({
    base: 'inline-flex',
    config: {
      variant: {
        default: 'solid',
        options: {
          solid: over(RAMP, (t) => `bg-${t.solid}`),
          // A plain string is still a legal option — an option that varies over
          // nothing should not have to pretend it varies over something.
          ghost: 'bg-transparent',
        },
      },
    },
  });

  it('derives the param from the options, with no params block', () => {
    expect(klass.axes.params).toEqual({ scale: ['red', 'blue'] });
    expect(klass.axes.groups).toEqual({ variant: ['solid', 'ghost'] });
  });

  it('applies the axis default when the prop is omitted', () => {
    expect(klass()).toBe('inline-flex bg-blue-9');
    expect(klass({ scale: 'red' })).toBe('inline-flex bg-red-9');
  });

  it('leaves non-varying options alone', () => {
    expect(klass({ variant: 'ghost', scale: 'red' })).toBe('inline-flex bg-transparent');
  });

  it('puts every combination in the safelist, not just the rendered one', () => {
    // The whole point: none of these exist as literal text anywhere, so a
    // missed combination is a class Tailwind never emits and a style that
    // breaks only in a production build.
    expect(klass.classes).toContain('bg-red-9');
    expect(klass.classes).toContain('bg-blue-9');
    expect(klass.classes).toContain('bg-transparent');
  });
});
