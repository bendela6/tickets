/**
 * Render a generated TypeScript module.
 *
 * Values are serialised with `as const` so a consumer gets literal types —
 * `TONE_RAMP.danger` is `'red'`, not `string` — which is the whole reason these
 * exist as TS rather than being read back out of the JSON at runtime.
 */
export interface TsModuleInput {
  /** The token file this module was built from, named in the header. */
  source: string;
  /** Prose placed under the header, explaining what the module is for. */
  summary?: string;
  /** Emitted in order, so a reader meets the vocabulary before the tables. */
  declarations: string[];
}

export function tsModule({ source, summary, declarations }: TsModuleInput): string {
  const header =
    `// GENERATED from tokens/${source} — do not edit.\n` +
    (summary ? summary.split('\n').map((l) => `// ${l}`.trimEnd() + '\n').join('') : '');
  return header + declarations.join('\n') + '\n';
}

/**
 * `export const NAME: Type = <json>;`
 *
 * Annotated rather than `as const`. A literal type is the point for the tone
 * tuples — `TONE_RAMP.danger` should be `'red'` — but on a 143-entry colour
 * table it only makes every consumer fight the type: a helper taking
 * `Record<string, string>` stops accepting `SURFACES` because its values are
 * narrowed to the exact hexes.
 */
export function constant(name: string, value: unknown, type?: string): string {
  const annotation = type ? `: ${type}` : '';
  return `export const ${name}${annotation} = ${JSON.stringify(value, null, 2)};\n`;
}

/** `export const NAME = ['a', 'b'] as const;` on one line — for short lists. */
export function tuple(name: string, values: readonly string[]): string {
  return `export const ${name} = [${values.map((v) => `'${v}'`).join(', ')}] as const;\n`;
}

/** `export type Name = (typeof SOURCE)[number];` */
export function memberType(name: string, source: string): string {
  return `export type ${name} = (typeof ${source})[number];\n`;
}
