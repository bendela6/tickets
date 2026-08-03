import { readTokenFile } from './utils/read-token-file.ts';
import type { FamilyTokens, ShadowDoc, TokenMap } from './utils/types.ts';

/**
 * The elevation scale — `xs`, `md`, `lg`.
 *
 * The only family whose value genuinely differs by theme in kind rather than
 * degree: the light theme casts a soft warm-grey shadow, the dark theme a
 * near-opaque black one, because a shadow on a dark surface has to work by
 * occlusion rather than by tint.
 *
 * The JSON is keyed `shadow: { xs, md, lg }` — the group names the family so
 * the leaf is just the rung. The `shadow-` prefix is re-applied here because
 * the raw custom property is `--ins-shadow-xs`; `shadowVarLines` strips it back
 * off to reach Tailwind's own `--shadow-xs`.
 */
export function generateShadows(): FamilyTokens {
  const docs = {
    light: readTokenFile<ShadowDoc>('shadows.light.tokens.json'),
    dark: readTokenFile<ShadowDoc>('shadows.dark.tokens.json'),
  };

  const build = (doc: ShadowDoc): TokenMap => {
    const map: TokenMap = {};
    for (const [rung, token] of Object.entries(doc.shadow)) {
      map[`shadow-${rung}`] = { value: token.$value, type: 'shadow' };
    }
    return map;
  };

  return { light: build(docs.light), dark: build(docs.dark) };
}
