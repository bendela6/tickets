import { readTokenFile } from './utils/read-token-file.ts';
import type { ColorDoc, FamilyTokens, TokenMap } from './utils/types.ts';

/**
 * The eleven perceptual ramps — `gray-1` … `pink-12`, plus each ramp's
 * `contrast` (the text that sits on its step 9).
 *
 * There is no alias layer. A ramp step IS the token: `gray-1` is the app
 * background, `red-9` the solid fill. The old primitive -> semantic indirection
 * existed so a rename could re-point `--color-accent`; with numbers the step
 * carries that meaning directly, and the indirection only hid which step a
 * colour was.
 *
 * The JSON is keyed `[scale]: { [step]: … }` so eleven ramps of thirteen rungs
 * read as a table rather than 143 sibling keys. It is flattened back to
 * `gray-1` here because that IS the custom-property name, and the shape every
 * downstream consumer matches on.
 */
export function generateColors(): FamilyTokens {
  const docs = {
    light: readTokenFile<ColorDoc>('colors.light.tokens.json'),
    dark: readTokenFile<ColorDoc>('colors.dark.tokens.json'),
  };

  const build = (doc: ColorDoc): TokenMap => {
    const map: TokenMap = {};
    for (const [scale, steps] of Object.entries(doc)) {
      for (const [step, token] of Object.entries(steps)) {
        map[`${scale}-${step}`] = { value: token.$value, type: 'color' };
      }
    }
    return map;
  };

  return { light: build(docs.light), dark: build(docs.dark) };
}
