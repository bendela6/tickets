// Zero-dependency check: assert that docs/design/design-system.html's "01
// Color" swatches match the resolved token hex values in
// apps/web/src/styles/tokens/*.tokens.json.
//
// This mirrors — rather than imports — the one-level `{group.name}` alias
// resolution in build-tokens.mjs. That script only exports
// `emitInstrumentCss` (CSS text lines for instrument.css), not a plain
// name -> hex map, so re-deriving the tiny resolve step here is simpler
// than building maps just to feed them through a CSS emitter and regex
// the hex back out of the output.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..', '..', '..');
const tokensDir = path.join(__dirname, '..', 'src', 'styles', 'tokens');
const designHtmlPath = path.join(repoRoot, 'docs', 'design', 'design-system.html');

const ALIAS_RE = /^\{([^}]+)\}$/;

function readJson(fileName) {
  return JSON.parse(readFileSync(path.join(tokensDir, fileName), 'utf8'));
}

// Primitives are keyed by group ("p"); lookup key is `p.<name>`.
function flattenPrimitives(doc) {
  const map = {};
  for (const [group, entries] of Object.entries(doc)) {
    for (const [name, token] of Object.entries(entries)) {
      map[`${group}.${name}`] = token.$value;
    }
  }
  return map;
}

// Semantic tokens flatten to `name -> $value` (an alias string or a raw hex).
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

function buildResolvedTokenMaps() {
  const primitivesMap = flattenPrimitives(readJson('primitives.tokens.json'));
  const light = resolveAliases(flattenSemantic(readJson('semantic.light.tokens.json')), primitivesMap);
  const dark = resolveAliases(flattenSemantic(readJson('semantic.dark.tokens.json')), primitivesMap);
  return { light, dark };
}

// design-system.html swatch label -> semantic token name.
const LABEL_TO_TOKEN = {
  'bg.app': 'app',
  'surface.raised': 'raised',
  'surface.inset': 'inset',
  'border.hairline': 'hairline',
  'border.control': 'control',
  'text.primary': 'ink',
  'text.secondary': 'ink-2',
  'text.tertiary': 'ink-3',
  accent: 'accent',
  'accent.hover': 'accent-hover',
  'accent.subtle': 'accent-subtle',
  danger: 'danger',
  'danger.subtle': 'danger-subtle',
};

// Matches `>label</div><div ...>#HEX</div>` swatch pairs, e.g.
//   ...sans-serif">bg.app</div><div style="...">#F7F6F2</div>
const SWATCH_RE = />([a-z.]+)<\/div><div[^>]*>(#[0-9A-Fa-f]{6})<\/div>/g;

function parseCard(html) {
  const map = {};
  for (const match of html.matchAll(SWATCH_RE)) {
    const [, label, hex] = match;
    map[label] = hex;
  }
  return map;
}

function extractColorSection(html) {
  const sectionStart = html.indexOf('data-screen-label="01 Color"');
  if (sectionStart === -1) {
    throw new Error('Could not find the "01 Color" section in design-system.html');
  }
  const sectionEnd = html.indexOf('</section>', sectionStart);
  if (sectionEnd === -1) {
    throw new Error('Could not find the end of the "01 Color" section');
  }
  return html.slice(sectionStart, sectionEnd);
}

// The section holds two cards (LIGHT then DARK), each gated by an
// `<sc-if value="{{showLight}}">` / `<sc-if value="{{showDark}}">` wrapper.
// Split on those markers and verify against each card's own LIGHT/DARK text
// label rather than assuming ordering.
function extractCards(section) {
  const lightStart = section.indexOf('showLight');
  const darkStart = section.indexOf('showDark');
  if (lightStart === -1 || darkStart === -1 || darkStart < lightStart) {
    throw new Error('Could not locate the LIGHT/DARK cards in the "01 Color" section');
  }
  const lightCard = section.slice(lightStart, darkStart);
  const darkCard = section.slice(darkStart);
  if (!lightCard.includes('>LIGHT<')) {
    throw new Error('First card in "01 Color" is not labeled LIGHT');
  }
  if (!darkCard.includes('>DARK<')) {
    throw new Error('Second card in "01 Color" is not labeled DARK');
  }
  return { lightCard, darkCard };
}

function main() {
  const html = readFileSync(designHtmlPath, 'utf8');
  const section = extractColorSection(html);
  const { lightCard, darkCard } = extractCards(section);
  const specLight = parseCard(lightCard);
  const specDark = parseCard(darkCard);

  const { light: tokenLight, dark: tokenDark } = buildResolvedTokenMaps();

  const mismatches = [];
  let checked = 0;

  for (const [label, token] of Object.entries(LABEL_TO_TOKEN)) {
    const specLightHex = specLight[label];
    const specDarkHex = specDark[label];
    const tokenLightHex = tokenLight[token];
    const tokenDarkHex = tokenDark[token];

    if (!specLightHex) {
      mismatches.push(`${label} (${token}): missing from LIGHT card in design-system.html`);
      continue;
    }
    if (!specDarkHex) {
      mismatches.push(`${label} (${token}): missing from DARK card in design-system.html`);
      continue;
    }
    if (tokenLightHex === undefined) {
      mismatches.push(`${label} (${token}): token "${token}" not found in semantic.light.tokens.json`);
      continue;
    }
    if (tokenDarkHex === undefined) {
      mismatches.push(`${label} (${token}): token "${token}" not found in semantic.dark.tokens.json`);
      continue;
    }

    let ok = true;
    if (specLightHex.toLowerCase() !== tokenLightHex.toLowerCase()) {
      mismatches.push(`${label} (${token}): spec-light=${specLightHex} token-light=${tokenLightHex}`);
      ok = false;
    }
    if (specDarkHex.toLowerCase() !== tokenDarkHex.toLowerCase()) {
      mismatches.push(`${label} (${token}): spec-dark=${specDarkHex} token-dark=${tokenDarkHex}`);
      ok = false;
    }
    if (ok) checked += 1;
  }

  if (mismatches.length > 0) {
    console.error('tokens:check FAILED — design-system.html diverges from tokens:');
    for (const mismatch of mismatches) {
      console.error(`  ${mismatch}`);
    }
    process.exit(1);
  }

  console.log(`ok: ${checked} color tokens match design-system.html`);
}

main();
