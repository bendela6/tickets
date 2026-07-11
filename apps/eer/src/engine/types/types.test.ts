// NOTE: expectTypeOf assertions are compile-time only — they cannot fail under
// `vitest run`. This file is enforced by `pnpm typecheck` (tsc compiles all of
// src, including tests); the vitest entries just keep the folder template whole.

import { describe, expectTypeOf, it } from 'vitest';

import type { Cardinality, Focus, Relationship, RoutingMode, Selection, Side } from './types';

describe('types', () => {
  it('keeps the closed unions the engine switches over', () => {
    expectTypeOf<Side>().toEqualTypeOf<'L' | 'R'>();
    expectTypeOf<RoutingMode>().toEqualTypeOf<'curved' | 'avoid' | 'ortho'>();
    expectTypeOf<Cardinality>().toEqualTypeOf<'1-1' | '1-n' | 'n-1' | 'n-m'>();
  });

  it('discriminates Selection by its type tag', () => {
    const sel = { type: 'entity', id: 'x' } as Selection;
    if (sel.type === 'entity') expectTypeOf(sel.id).toEqualTypeOf<string>();
    if (sel.type === 'none') expectTypeOf(sel).not.toHaveProperty('id');
  });

  it('allows Focus to be cleared with null', () => {
    expectTypeOf<null>().toMatchTypeOf<Focus>();
  });

  it('keeps routing/pin-slot fields optional on Relationship (loader fills them later)', () => {
    expectTypeOf<Relationship['_route']>().toEqualTypeOf<Relationship['_route'] | undefined>();
    expectTypeOf<Relationship['_srcSlot']>().toEqualTypeOf<number | undefined>();
  });
});
