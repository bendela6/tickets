import path from 'node:path';

/**
 * The only paths Generate may write, keyed by the name the client uses. The
 * client never sends a path, so traversal is structurally impossible — an
 * unrecognised key is simply refused.
 */
export const OUTPUTS = Object.freeze({
  'favicon.svg': 'apps/web/public/favicon.svg',
  'icon-mono.svg': 'apps/web/public/icon-mono.svg',
  'icon-192.png': 'apps/web/public/icon-192.png',
  'icon-512.png': 'apps/web/public/icon-512.png',
  'apple-touch-icon.png': 'apps/web/public/apple-touch-icon.png',
  'site.webmanifest': 'apps/web/public/site.webmanifest',
  'icons.config.json': 'apps/web/icons.config.json',
} as const);

export type OutputName = keyof typeof OUTPUTS;

/**
 * The names the browser must supply, because a canvas is the only rasteriser.
 * Everything else the plugin derives from the config itself.
 */
export const PNG_NAMES = ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png'] as const;

/**
 * Absolute destination for a name, or null if the name is not in the table.
 * The result is re-checked against `repoRoot` even though the table is
 * hardcoded — defence in depth costs one comparison.
 */
export function resolveOutput(name: string, repoRoot: string): string | null {
  if (!Object.prototype.hasOwnProperty.call(OUTPUTS, name)) return null;
  const rel = OUTPUTS[name as OutputName];
  const abs = path.resolve(repoRoot, rel);
  if (!abs.startsWith(path.resolve(repoRoot) + path.sep)) return null;
  return abs;
}
