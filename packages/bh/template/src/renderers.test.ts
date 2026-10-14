import * as v from 'valibot';
import { baseKinds, createKindRegistry, type BaseKind, type KindSpec } from '@bh/resource';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { resolvePart } from './part';
import { entryOf, named } from './registry';
import {
  baseDefaultRenderers,
  baseRendererSpecs,
  canShow,
  fits,
  partDefaults,
  type BaseRenderers,
  type RendererSpec,
} from './renderers';

/** A spec's options' schema, or one taking only {} for a renderer that takes none. */
function optionsOf(spec: RendererSpec<unknown>): v.GenericSchema {
  return spec.options ?? v.strictObject({});
}

describe('bh’s renderers', () => {
  it('are the eleven the feature names, and check and code for booleans and json', () => {
    expect(Object.keys(baseRendererSpecs)).toEqual([
      'text',
      'link',
      'pill',
      'date',
      'number',
      'avatar',
      'user',
      'icon',
      'progress',
      'meter',
      'trend',
      'check',
      'code',
    ]);
    expect(Object.isFrozen(baseRendererSpecs)).toBe(true);
  });

  it('check their options by their schemas, which give each one’s options type', () => {
    type OutputOf<K extends keyof BaseRenderers> = v.InferOutput<
      NonNullable<(typeof baseRendererSpecs)[K]['options']>
    >;
    expectTypeOf<OutputOf<'pill'>>().toEqualTypeOf<BaseRenderers['pill']>();
    expectTypeOf<OutputOf<'progress'>>().toEqualTypeOf<BaseRenderers['progress']>();
    expectTypeOf<BaseRenderers['trend']>().toEqualTypeOf<{ good?: 'up' | 'down' }>();

    const accepts = (name: keyof BaseRenderers, options: unknown) => {
      return v.is(optionsOf(baseRendererSpecs[name]), options);
    };
    expect(accepts('pill', { variant: 'solid' })).toBe(true);
    expect(accepts('pill', { variant: 'loud' })).toBe(false);
    expect(accepts('avatar', { size: 'lg', shape: 'square' })).toBe(true);
    expect(accepts('avatar', { size: 'huge' })).toBe(false);
    expect(accepts('progress', { max: 8 })).toBe(true);
    expect(accepts('progress', { max: 0 })).toBe(false);
    expect(accepts('meter', {})).toBe(true);
    expect(accepts('trend', { good: 'down' })).toBe(true);
    // A key no renderer takes is refused, so a misspelt option is found.
    expect(accepts('pill', { varient: 'solid' })).toBe(false);
    // A renderer that takes no options takes {} alone.
    expect(accepts('text', {})).toBe(true);
    expect(accepts('text', { mono: true })).toBe(false);
  });

  it('say which kinds each shows, and the room the bars need', () => {
    expect(canShow(baseRendererSpecs.text, 'json')).toBe(true);
    expect(canShow(baseRendererSpecs.pill, 'option')).toBe(true);
    expect(canShow(baseRendererSpecs.pill, 'number')).toBe(false);
    expect(canShow(baseRendererSpecs.user, 'ref')).toBe(true);
    expect(fits(baseRendererSpecs.text, 0)).toBe(true);
    expect(fits(baseRendererSpecs.progress, 48)).toBe(false);
    expect(fits(baseRendererSpecs.progress, 64)).toBe(true);
  });
});

describe('each kind’s default renderer', () => {
  it('names one of bh’s, for every one of bh’s kinds, that shows that kind', () => {
    const kinds = baseKinds.map((kind) => kind.name).sort();
    expect(Object.keys(baseDefaultRenderers).sort()).toEqual(kinds);
    for (const [kind, name] of Object.entries(baseDefaultRenderers)) {
      expect(canShow(baseRendererSpecs[name], kind), `${kind} → ${name}`).toBe(true);
    }
    expectTypeOf(baseDefaultRenderers).toEqualTypeOf<
      Readonly<Record<BaseKind, keyof BaseRenderers>>
    >();
  });

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
    const defaults = partDefaults(
      { ...baseDefaultRenderers, color: 'swatch' },
      createKindRegistry([color]),
    );
    const of = (kind: string) => {
      return resolvePart({ field: 'x' }, { type: { kind } }, defaults).renderer;
    };
    expect(of('option')).toBe('pill');
    expect(of('ref')).toBe('user');
    expect(of('boolean')).toBe('check');
    expect(of('json')).toBe('code');
    expect(of('color')).toBe('swatch');
    // A kind with no default, and a kind's name that every object has, fall back to text.
    expect(of('unknown')).toBe('text');
    expect(of('constructor')).toBe('text');
  });
});

describe('a registry', () => {
  it('finds an entry by its own name only', () => {
    expect(entryOf(baseRendererSpecs, 'pill')).toBe(baseRendererSpecs.pill);
    expect(entryOf(baseRendererSpecs, 'sparkline')).toBeUndefined();
    expect(entryOf(baseRendererSpecs, 'toString')).toBeUndefined();
    expect(entryOf(baseRendererSpecs, '__proto__')).toBeUndefined();
  });

  it('reads a renderer or a format named alone or with its options', () => {
    expect(named('pill')).toEqual({ name: 'pill', options: {} });
    expect(named({ name: 'meter', options: { max: 16 } })).toEqual({
      name: 'meter',
      options: { max: 16 },
    });
  });
});
