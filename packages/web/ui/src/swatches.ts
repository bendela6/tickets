import primitives from './tokens/primitives.tokens.json';
import semanticLight from './tokens/semantic.light.tokens.json';
import semanticDark from './tokens/semantic.dark.tokens.json';

// Resolve one semantic token name to its hex. Most tokens come from light theme;
// ink-3 is drawn from dark theme. Follows one level of `{group.name}` alias
// into the primitives, mirroring scripts/build-tokens.mjs resolveTokenMaps().
function resolve(name: string): string {
  // Use dark theme for ink-3; light theme for others
  const semantic = name === 'ink-3' ? semanticDark : semanticLight;

  for (const entries of Object.values(semantic as Record<string, Record<string, { $value: string }>>)) {
    const token = entries[name];
    if (!token) continue;
    const match = /^\{([^}]+)\}$/.exec(token.$value);
    if (!match) return token.$value.toUpperCase();
    const [group, primitiveName] = match[1]!.split('.', 2) as [string, string];
    const primitive = (primitives as Record<string, Record<string, { $value: string }>>)[group]?.[primitiveName];
    if (!primitive) throw new Error(`Unresolved alias {${match[1]}} for swatch token "${name}"`);
    return primitive.$value.toUpperCase();
  }

  throw new Error(`Unknown swatch token "${name}"`);
}

// Color-picker presets for type/status configuration — previously hardcoded
// hex arrays in settings/types-tab.tsx and settings/workflow-tab.tsx.
export const SWATCHES = ['accent', 'kind-done', 'kind-blocked', 'opt-red', 'kind-active', 'ink-3'].map(
  resolve,
);
