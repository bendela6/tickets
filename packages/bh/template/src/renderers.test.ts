import * as v from 'valibot';
import { baseKinds, type KindSpec } from '@bh/resource';
import { describe, expect, it } from 'vitest';
import { partDefaults, resolvePart } from './part';
import { entryOf, named } from './registry';
import { canShow, fits, rendererData, type RendererSpec } from './renderer-registry';

// An app's defaults: each kind's renderer.
const defaults = { option: 'pill', ref: 'user', boolean: 'check', color: 'swatch' };

describe('a renderer spec', () => {
  const pill: RendererSpec = { kinds: ['option', 'text'] };
  const bar: RendererSpec = { kinds: ['number'], minWidth: 64 };
  const text: RendererSpec = { kinds: 'any' };

  it('says which kinds it shows', () => {
    expect(canShow(pill, 'option')).toBe(true);
    expect(canShow(pill, 'number')).toBe(false);
    expect(canShow(text, 'json')).toBe(true);
  });

  it('says the room it needs', () => {
    expect(fits(text, 0)).toBe(true);
    expect(fits(bar, 48)).toBe(false);
    expect(fits(bar, 64)).toBe(true);
  });

  it('is checked: a kind, or any, and a width', () => {
    expect(v.is(rendererData, pill)).toBe(true);
    expect(v.is(rendererData, { kinds: [] })).toBe(false);
    expect(v.is(rendererData, { kinds: 'any', minWidth: -1 })).toBe(false);
  });
});

describe('each kind’s default renderer', () => {
  it('is what a part naming no renderer gets, an app’s own kind’s too', () => {
    const color: KindSpec = {
      name: 'color',
      value: () => v.string(),
      many: false,
      operators: ['equals'],
      sort: false,
      group: true,
      search: false,
    };
    const resolved = partDefaults(defaults, baseKinds.register({ color }));
    const of = (kind: string) => {
      return resolvePart({ field: 'x' }, { type: { kind } }, resolved).renderer;
    };
    expect(of('option')).toBe('pill');
    expect(of('ref')).toBe('user');
    expect(of('boolean')).toBe('check');
    expect(of('color')).toBe('swatch');
    // A kind with no default, and a kind's name that every object has, fall back to text.
    expect(of('unknown')).toBe('text');
    expect(of('constructor')).toBe('text');
  });
});

describe('a registry', () => {
  it('finds an entry of a plain record by its own name only', () => {
    expect(entryOf(defaults, 'option')).toBe('pill');
    expect(entryOf(defaults, 'sparkline')).toBeUndefined();
    expect(entryOf(defaults, 'toString')).toBeUndefined();
    expect(entryOf(defaults, '__proto__')).toBeUndefined();
  });

  it('reads a renderer or a format named alone or with its options', () => {
    expect(named('pill')).toEqual({ name: 'pill', options: {} });
    expect(named({ name: 'meter', options: { max: 16 } })).toEqual({
      name: 'meter',
      options: { max: 16 },
    });
  });
});
