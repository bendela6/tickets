// color-mix() recipe strings for runtimeStyle custom properties. Per-element
// palette colors (zones, entities, edges) can't become static theme tokens: a
// var() embedded in a :root token is substituted at :root, so it would ignore
// the element's own color. Building the final string in JS keeps the recipe
// next to the component while the mix still resolves at the element.
export function mix(color: string, percent: number, base = 'transparent'): string {
  return `color-mix(in srgb, ${color} ${percent}%, ${base})`;
}
