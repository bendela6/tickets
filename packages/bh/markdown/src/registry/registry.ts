import { toPrompt } from '../prompt';
import type { AnyRenderer, Registry } from './types';

/**
 * The set of blocks a page may use, by name. A renderer must say what it is
 * and show at least one example, since `toPrompt` teaches an authoring model
 * from exactly those.
 */
export function createRegistry(renderers: readonly AnyRenderer[] = []): Registry {
  const map = new Map<string, AnyRenderer>();

  const register = (renderer: AnyRenderer) => {
    if (map.has(renderer.name)) {
      throw new Error(`Renderer "${renderer.name}" is already registered`);
    }
    if (!renderer.description.trim()) {
      throw new Error(`Renderer "${renderer.name}" has no description`);
    }
    if (renderer.examples.length === 0) {
      throw new Error(`Renderer "${renderer.name}" has no examples`);
    }
    map.set(renderer.name, renderer);
  };
  renderers.forEach(register);

  return {
    get: (name) => map.get(name),
    names: () => new Set(map.keys()),
    all: () => [...map.values()],
    register,
    toPrompt: (options) => toPrompt([...map.values()], options),
  };
}
