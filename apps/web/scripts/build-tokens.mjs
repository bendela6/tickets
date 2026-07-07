// Zero-dependency token build script.
//
// Reads the primitive + semantic (light/dark) token JSON files, resolves
// one level of `{group.name}` alias references from semantic values against
// the primitives map, and SPLICES the token-derived regions of
// `instrument.css` back in place — between the `tokens:light` /
// `tokens:dark` / `tokens:theme` marker comments — leaving every
// hand-authored line around them (the `@layer base` reset, the
// radius/font/text vars inside `@theme inline`, the `.md` prose rules)
// byte-for-byte untouched.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tokensDir = path.join(__dirname, '..', 'src', 'styles', 'tokens');
const cssFile = path.join(__dirname, '..', 'src', 'styles', 'instrument.css');

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

function buildTokenMaps() {
  const primitivesDoc = readJson('primitives.tokens.json');
  const lightDoc = readJson('semantic.light.tokens.json');
  const darkDoc = readJson('semantic.dark.tokens.json');

  const primitivesMap = flattenPrimitives(primitivesDoc);
  const light = resolveAliases(flattenSemantic(lightDoc), primitivesMap);
  const dark = resolveAliases(flattenSemantic(darkDoc), primitivesMap);
  return { light, dark };
}

// Resolve the token JSON into the three generated regions of instrument.css:
// the `:root` `--ins-*` lines (light), the `[data-theme='dark']` `--ins-*`
// lines (dark), and the `@theme inline` `--color-*`/`--shadow-*` bridge
// lines (theme). Exported so other scripts (e.g. a docs/token-report task)
// can get at the same generated CSS text without re-deriving it and without
// touching instrument.css.
export function emitInstrumentCss({ light, dark }) {
  const names = Object.keys(light);
  const colorNames = names.filter((name) => light[name].type !== 'shadow');
  const shadowNames = names.filter((name) => light[name].type === 'shadow');

  return {
    light: cssLines(light),
    dark: cssLines(dark),
    theme: colorVarLines(colorNames) + shadowVarLines(shadowNames),
  };
}

// Marker comment pairs in instrument.css. Only the text strictly between
// each pair is regenerated; the markers themselves, and everything outside
// them (base layer, radius/font/text vars, .md prose), are left alone.
const MARKERS = [
  { start: '/* tokens:light — generated, do not edit */', end: '/* /tokens:light */', region: 'light' },
  { start: '/* tokens:dark — generated, do not edit */', end: '/* /tokens:dark */', region: 'dark' },
  { start: '/* tokens:theme — generated, do not edit */', end: '/* /tokens:theme */', region: 'theme' },
];

// Replace the body of one marker pair with freshly generated lines. The
// markers are always indented 2 spaces in instrument.css, so the
// replacement re-establishes that indentation itself rather than trusting
// whatever was there before — making the splice idempotent regardless of
// prior contents.
function spliceRegion(css, { start, end }, body, indent = '  ') {
  const startIdx = css.indexOf(start);
  if (startIdx === -1) {
    throw new Error(`Marker not found in instrument.css: ${start}`);
  }
  const afterStart = startIdx + start.length;
  const endIdx = css.indexOf(end, afterStart);
  if (endIdx === -1) {
    throw new Error(`Marker not found in instrument.css: ${end}`);
  }
  return css.slice(0, afterStart) + '\n' + body + indent + css.slice(endIdx);
}

function build() {
  const { light, dark } = buildTokenMaps();
  const regions = emitInstrumentCss({ light, dark });

  let css = readFileSync(cssFile, 'utf8');
  for (const marker of MARKERS) {
    css = spliceRegion(css, marker, regions[marker.region]);
  }
  writeFileSync(cssFile, css, 'utf8');
  console.log(`Updated ${path.relative(process.cwd(), cssFile)}`);
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  build();
}
