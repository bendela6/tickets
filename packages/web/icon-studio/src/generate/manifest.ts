/**
 * `purpose: 'maskable any'` covers both cases with one file: Android crops it
 * for the launcher, everything else uses it as-is.
 *
 * Takes the resolved chip field colour directly, not a document — the
 * manifest has no notion of elements or inks, only the one colour it themes
 * itself with. The caller resolves that colour from whatever ink the `chip`
 * variant's field actually names.
 */
export function buildManifest(chipColor: string): string {
  // `name`/`short_name` are hardcoded rather than derived — the mark has no
  // notion of app naming. That means a hand-edit to a written
  // site.webmanifest's `name` is silently discarded on the next Generate,
  // since this function always re-derives the whole file from `chipColor`.
  // Not deriving a `name` here is deliberate: the icon studio owns the mark,
  // not the app's branding.
  const manifest = {
    name: 'tickets',
    short_name: 'tickets',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: chipColor,
    theme_color: chipColor,
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable any' },
    ],
  };
  return JSON.stringify(manifest, null, 2) + '\n';
}
