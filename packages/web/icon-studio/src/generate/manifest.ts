import type { MarkConfig } from '../config';

/**
 * `purpose: 'maskable any'` covers both cases with one file: Android crops it
 * for the launcher, everything else uses it as-is.
 */
export function buildManifest(c: MarkConfig): string {
  const manifest = {
    name: 'tickets',
    short_name: 'tickets',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: c.chip,
    theme_color: c.chip,
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable any' },
    ],
  };
  return JSON.stringify(manifest, null, 2) + '\n';
}
