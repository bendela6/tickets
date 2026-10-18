import * as v from 'valibot';
import { defineRegistry } from '@bh/registry';
import type { AnyRenderer, Example, Renderer } from './types';

/**
 * What the block registry checks of each block: a name, a description that
 * says something, at least one example and a component, since `toPrompt`
 * teaches an authoring model from exactly those.
 */
export const rendererData = v.object({
  name: v.pipe(v.string(), v.nonEmpty('a block has a name')),
  description: v.custom<string>(
    (value) => typeof value === 'string' && value.trim() !== '',
    'says what the block is',
  ),
  examples: v.pipe(
    v.array(v.custom<Example>((value) => typeof value === 'string' || typeof value === 'object')),
    v.minLength(1, 'shows one at least'),
  ),
  component: v.custom<AnyRenderer['component']>(
    (value) => typeof value === 'function' || (typeof value === 'object' && value !== null),
    'is a component',
  ),
});

/**
 * A registry holding no blocks, for a page that draws none of this package's:
 * `noBlocks.register({ plant })`. `define` types a block by its schema, so
 * its component is given what that schema gives.
 */
export const noBlocks = defineRegistry({
  name: 'block',
  schema: rendererData,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  define: <T>(renderer: Renderer<T>): Renderer<any> => renderer,
});
