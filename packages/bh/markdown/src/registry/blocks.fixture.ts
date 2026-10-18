import { noBlocks } from './registry';
import type { AnyRenderer } from './types';

/** A registry of these blocks, each by its own name: what a test reads and draws with. */
export function blocksOf(renderers: readonly AnyRenderer[]) {
  return noBlocks.register(
    Object.fromEntries(renderers.map((renderer) => [renderer.name, renderer])),
  );
}
