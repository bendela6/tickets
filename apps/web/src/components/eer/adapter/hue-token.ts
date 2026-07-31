// Instrument hue NAME (what @tickets/db records in SCHEMA_GROUPS[].color and
// in the namespace-fallback palette) -> the token string the diagram paints a
// group with.
//
// THE LITERALS ARE THE MECHANISM, not decoration. tokens.css declares the
// palette inside `@theme inline`, and with `inline` a utility bakes the value
// in directly — `text-indigo-11` compiles to `color: var(--ins-indigo-11)` —
// so generating a `.bg-indigo-9` utility does NOT put `--color-indigo-9` into
// :root. The only thing that does is the exact text `var(--color-<hue>-9)`
// appearing in a file Tailwind scans.
//
// Measured against the built bundle: `bg-pink-3`, `bg-purple-3`, `bg-teal-3`
// and `bg-yellow-3` are all declared in safelist.generated.css, and NONE of
// --color-pink-3 / -purple-3 / -teal-3 / -yellow-3 is emitted — while all 23
// `var(--color-*)` literals that do appear in scanned source are. A safelist
// entry therefore cannot fix this; a literal can.
//
// This replaced `var(--color-${g.color}-9)` built at runtime in the adapter,
// which guaranteed nothing: coverage was incidental (eight hues survived only
// because engine/colors/group-color names them as literals, and indigo — the
// hue of the largest curated group — only because rich-text/toolbar.tsx
// happens to contain that string). An undefined custom property does not fall
// back, it invalidates the whole declaration: `stroke: var(--edge-c)` becomes
// `stroke: none`, i.e. invisible edges. That exact failure already shipped
// once on this branch (d9c7493).
//
// hue-token.test.ts fails if either db-side hue list grows past this map, or
// if a token here stops being declared in tokens.css.
export const HUE_TOKEN: Record<string, string> = {
  blue: 'var(--color-blue-9)',
  cyan: 'var(--color-cyan-9)',
  green: 'var(--color-green-9)',
  indigo: 'var(--color-indigo-9)',
  orange: 'var(--color-orange-9)',
  pink: 'var(--color-pink-9)',
  purple: 'var(--color-purple-9)',
  red: 'var(--color-red-9)',
  teal: 'var(--color-teal-9)',
  yellow: 'var(--color-yellow-9)',
};

/**
 * The token for a hue name, or null when the name is not one this app can
 * paint. Null rather than a synthesized `var(--color-<x>-9)`: the caller drops
 * the override and lets the engine's own GROUP_PALETTE (indexed by zone order,
 * and literal in group-color.ts) colour the group instead — a wrong-but-visible
 * hue beats an invalid declaration that paints nothing.
 */
export function hueToken(hue: string): string | null {
  return HUE_TOKEN[hue] ?? null;
}
