import { describe, expect, it } from 'vitest';
import { axis, isExpansion, over } from './axis';
import { variants } from './variants';

const SIZE = axis('size', ['sm', 'md', 'lg'], 'md');
const SCALE = axis('scale', ['red', 'blue'], 'blue');
const STATE = axis('state', ['on', 'off'], 'off');

describe('axis', () => {
  it('is its name, its domain and a fallback — nothing else', () => {
    // There used to be a second, record-shaped domain that handed the callback
    // a resolved ramp (`t.solid`). Call sites spell the rung now, so the record
    // form and the handle it carried had no users left.
    expect(SIZE).toEqual({ name: 'size', keys: ['sm', 'md', 'lg'], fallback: 'md' });
  });
});

describe('over', () => {
  it('resolves against the selection', () => {
    const expansion = over(SCALE, (tone) => `bg-${tone}-9`);
    expect(isExpansion(expansion)).toBe(true);
    expect(expansion.at({ scale: 'red' })).toBe('bg-red-9');
  });

  it('falls back when the axis is unset or outside its own domain', () => {
    // A `scale` of `primary` is a tone name, not a scale name. Letting it
    // through would build `bg-primary-9`, a class that does not exist.
    const expansion = over(SCALE, (tone) => `bg-${tone}-9`);
    expect(expansion.at({})).toBe('bg-blue-9');
    expect(expansion.at({ scale: 'primary' })).toBe('bg-blue-9');
  });

  it('builds each combination once and reuses it', () => {
    let built = 0;
    const expansion = over(SCALE, (tone) => {
      built += 1;
      return `bg-${tone}-9`;
    });
    expansion.at({ scale: 'red' });
    expansion.at({ scale: 'red' });
    expansion.at({ scale: 'blue' });
    expect(built).toBe(2);
  });

  it('builds nothing on its own, but variants() walks it all at construction', () => {
    // Worth stating plainly, because the two halves point opposite ways.
    // `over()` alone is lazy — nothing is built until something asks.
    let built = 0;
    const expansion = over(SCALE, () => {
      built += 1;
      return '';
    });
    expect(built).toBe(0);

    // But an expansion only ever exists inside a config, and `variants()`
    // enumerates for the safelist as soon as it is called. So in practice the
    // whole domain IS built at module load — the memoisation buys a cheap
    // render, not a cheap import.
    variants({ base: '', config: { v: { default: 'x', options: { x: expansion } } } });
    expect(built).toBe(SCALE.keys.length);
  });

  it('composes axes and walks their whole product for the safelist', () => {
    const expansion = over(SCALE, STATE, (tone, state) => `bg-${tone}-9 ${state}`);
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
          solid: over(SCALE, (tone) => `bg-${tone}-9`),
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
