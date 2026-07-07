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

function flattenSemantic(doc) {
  const map = {};
  for (const entries of Object.values(doc)) {
    for (const [name, token] of Object.entries(entries)) {
      map[name] = token.$value;
    }
  }
  return map;
}

// Resolve `{group.name}` alias references (one level) against primitives.
function resolveAliases(semanticMap, primitivesMap) {
  const resolved = {};
  for (const [name, value] of Object.entries(semanticMap)) {
    const match = ALIAS_RE.exec(value);
    if (match) {
      const aliasKey = match[1];
      if (!(aliasKey in primitivesMap)) {
        throw new Error(`Unresolved alias {${aliasKey}} for token "${name}"`);
      }
      resolved[name] = primitivesMap[aliasKey];
    } else {
      resolved[name] = value;
    }
  }
  return resolved;
}

function cssLines(map, indent = '  ') {
  return Object.entries(map)
    .map(([name, value]) => `${indent}--ins-${name}: ${value};\n`)
    .join('');
}

function colorVarLines(names, indent = '  ') {
  return names.map((name) => `${indent}--color-${name}: var(--ins-${name});\n`).join('');
}

export function emitInstrumentCss({ light, dark }) {
  const names = Object.keys(light);

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
  css += colorVarLines(names);
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
