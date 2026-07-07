// Zero-dependency token build script.
//
// Reads the primitive + semantic (light/dark) token JSON files, resolves
// one level of `{group.name}` alias references from semantic values against
// the primitives map, and emits `instrument.generated.css` in the same
// shape as the hand-written `instrument.css` (:root, [data-theme='dark'],
// @theme inline).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tokensDir = path.join(__dirname, '..', 'src', 'styles', 'tokens');
const outFile = path.join(__dirname, '..', 'src', 'styles', 'instrument.generated.css');

const ALIAS_RE = /^\{([^}]+)\}$/;

function readJson(fileName) {
  const filePath = path.join(tokensDir, fileName);
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

// Flatten a token document down to `name -> $value`.
//   - Primitives: keyed by group ("p"), lookup key is `p.<name>`.
//   - Semantic: keyed by group ("ins"), lookup key is the leaf name itself.
function flattenPrimitives(doc) {
  const map = {};
  for (const [group, entries] of Object.entries(doc)) {
    for (const [name, token] of Object.entries(entries)) {
      map[`${group}.${name}`] = token.$value;
    }
  }
  return map;
}

// Semantic tokens flatten to `name -> { value, type }` — the type (e.g.
// "color" vs "shadow") rides along so the emitter can route each token to
// the right `@theme inline` shape without re-deriving it from the value.
function flattenSemantic(doc) {
  const map = {};
  for (const entries of Object.values(doc)) {
    for (const [name, token] of Object.entries(entries)) {
      map[name] = { value: token.$value, type: token.$type };
    }
  }
  return map;
}

// Resolve `{group.name}` alias references (one level) against primitives.
function resolveAliases(semanticMap, primitivesMap) {
  const resolved = {};
  for (const [name, { value, type }] of Object.entries(semanticMap)) {
    const match = ALIAS_RE.exec(value);
    if (match) {
      const aliasKey = match[1];
      if (!(aliasKey in primitivesMap)) {
        throw new Error(`Unresolved alias {${aliasKey}} for token "${name}"`);
      }
      resolved[name] = { value: primitivesMap[aliasKey], type };
    } else {
      resolved[name] = { value, type };
    }
  }
  return resolved;
}

function cssLines(map, indent = '  ') {
  return Object.entries(map)
    .map(([name, { value }]) => `${indent}--ins-${name}: ${value};\n`)
    .join('');
}

// `--color-<name>: var(--ins-<name>);` for every color-typed token.
function colorVarLines(names, indent = '  ') {
  return names.map((name) => `${indent}--color-${name}: var(--ins-${name});\n`).join('');
}

// Shadows bridge into `@theme` as `--shadow-<suffix>` (Tailwind's own var
// name), not `--color-*` — `shadow-sm` -> `--shadow-sm`, using whatever
// follows the "shadow-" prefix in the token name.
function shadowVarLines(names, indent = '  ') {
  return names
    .map((name) => `${indent}--shadow-${name.slice('shadow-'.length)}: var(--ins-${name});\n`)
    .join('');
}

// Static tail of `@theme inline`: type/radius/text tokens that aren't part
// of the `--ins-*` DTCG pipeline (no primitive/semantic tier for these —
// see the plan's non-goals). Kept verbatim here to match instrument.css.
const THEME_STATIC_TAIL = `  --font-sans: 'IBM Plex Sans', system-ui, sans-serif;
  --font-mono: 'IBM Plex Mono', ui-monospace, monospace;
  --radius-ctrl: 5px;
  --radius-card: 8px;
  --radius-panel: 12px;
  --text-label: 11px;
  --text-label--line-height: 1.2;
  --text-label--letter-spacing: 0.06em;
  --text-meta: 12px;
  --text-meta--line-height: 1.4;
  --text-ui: 13px;
  --text-ui--line-height: 1.45;
`;

export function emitInstrumentCss({ light, dark }) {
  const names = Object.keys(light);
  const colorNames = names.filter((name) => light[name].type !== 'shadow');
  const shadowNames = names.filter((name) => light[name].type === 'shadow');

  let css = '';
  css += ':root {\n';
  css += cssLines(light);
  css += '}\n\n';

  css += "[data-theme='dark'] {\n";
  css += cssLines(dark);
  css += '}\n\n';

  css += '@theme inline {\n';
  css += '  --color-*: initial;\n';
  css += '  --color-white: #ffffff;\n';
  css += '  --color-black: #000000;\n';
  css += colorVarLines(colorNames);
  css += shadowVarLines(shadowNames);
  css += THEME_STATIC_TAIL;
  css += '}\n';

  return css;
}

function build() {
  const primitivesDoc = readJson('primitives.tokens.json');
  const lightDoc = readJson('semantic.light.tokens.json');
  const darkDoc = readJson('semantic.dark.tokens.json');

  const primitivesMap = flattenPrimitives(primitivesDoc);
  const lightMap = resolveAliases(flattenSemantic(lightDoc), primitivesMap);
  const darkMap = resolveAliases(flattenSemantic(darkDoc), primitivesMap);

  const css = emitInstrumentCss({ light: lightMap, dark: darkMap });
  writeFileSync(outFile, css, 'utf8');
  console.log(`Wrote ${path.relative(process.cwd(), outFile)}`);
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  build();
}
