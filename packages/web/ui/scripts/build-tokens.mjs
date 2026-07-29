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
const tokensDir = path.join(__dirname, '..', 'src', 'tokens', 'source');
const cssFile = path.join(__dirname, '..', 'src', 'tokens', 'tokens.css');

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

// Resolve the primitive + semantic (light/dark) token JSON into
// `name -> { value, type }` maps. This is the single source of truth for
// token resolution — every script that needs resolved token hex (the CSS
// build, the design-doc parity check) calls this rather than re-deriving
// its own copy of the alias-resolution logic.
const nextDir = path.join(__dirname, '..', 'src', 'tokens', 'next');
const readNext = (name) => JSON.parse(readFileSync(path.join(nextDir, name), 'utf8'));

/**
 * Resolve the numbered token set into `name -> { value, type }` per theme.
 *
 * There is no alias layer any more. A ramp step IS the token: `gray-1` is the
 * app background, `red-9` the solid fill, `indigo-contrast` the text that sits
 * on indigo-9. The old primitive -> semantic indirection existed so a rename
 * could re-point `--color-accent`; with numbers the step number carries that
 * meaning directly, and the indirection only hid which step a colour was.
 *
 * Three kinds of name survive that are NOT ramp steps, because nothing on a
 * perceptual ramp can express them: the two surfaces (raised is pure white in
 * the light theme, which no gray step is), and the literals — a folder glyph's
 * gold and the search highlight are chosen for recognition, not for a contrast
 * role.
 */
export function resolveTokenMaps() {
  const colors = { light: readNext('colors.light.tokens.json'), dark: readNext('colors.dark.tokens.json') };
  const shadows = { light: readNext('shadows.light.tokens.json'), dark: readNext('shadows.dark.tokens.json') };
  const semantic = readNext('semantic.tokens.json');

  const build = (theme) => {
    const map = {};
    for (const [name, token] of Object.entries(colors[theme].ins)) {
      map[name] = { value: token.$value, type: 'color' };
    }
    for (const [name, byTheme] of Object.entries(semantic.surface)) {
      map[`surface-${name}`] = { value: byTheme[theme], type: 'color' };
    }
    for (const [name, byTheme] of Object.entries(semantic.literal)) {
      map[name] = { value: byTheme[theme], type: 'color' };
    }
    for (const [name, token] of Object.entries(shadows[theme].ins)) {
      map[name] = { value: token.$value, type: 'shadow' };
    }
    return map;
  };

  return { light: build('light'), dark: build('dark') };
}

// Resolve the token JSON into the three generated regions of instrument.css:
// the `:root` `--ins-*` lines (light), the `[data-theme='dark']` `--ins-*`
// lines (dark), and the `@theme inline` `--color-*`/`--shadow-*` bridge
// lines (theme). Exported so other scripts (e.g. a docs/token-report task)
// can get at the same generated CSS text without re-deriving it and without
// touching instrument.css.
export function emitInstrumentCss({ light, dark }) {
  const lightNames = Object.keys(light);
  const darkNames = Object.keys(dark);
  if (lightNames.length !== darkNames.length || !lightNames.every((name) => name in dark)) {
    const lightSet = new Set(lightNames);
    const darkSet = new Set(darkNames);
    const asymmetric = [
      ...lightNames.filter((name) => !darkSet.has(name)).map((name) => `${name} (light only)`),
      ...darkNames.filter((name) => !lightSet.has(name)).map((name) => `${name} (dark only)`),
    ];
    throw new Error(`light/dark token sets diverge: ${asymmetric.join(', ')}`);
  }

  const names = lightNames;
  const colorNames = names.filter((name) => light[name].type !== 'shadow');
  const shadowNames = names.filter((name) => light[name].type === 'shadow');

  return {
    light: cssLines(light),
    dark: cssLines(dark),
    theme: colorVarLines(colorNames) + shadowVarLines(shadowNames),
  };
}

const tonesFile = path.join(__dirname, '..', 'src', 'style', 'tones', 'tones.generated.ts');

// Emit src/style/tones/tones.generated.ts from tones.tokens.json. Class strings are
// LITERALS on purpose: Tailwind's scanner cannot see dynamically-built class
// names, so the full utility text for every tone x emphasis must exist in a
// scanned source file. This file lives under src/, which `@source './'` in
// tokens.css already covers for every consumer.
export function emitTones({ light }) {
  const doc = readNext('tones.tokens.json');
  const roles = readNext('semantic.tokens.json').scale;
  // `emphasis` names rungs rather than numbering them, so resolve one level
  // before building any class string. A typo in a step name would otherwise
  // sail through as `undefined` and produce `bg-red-undefined`.
  const steps = Object.fromEntries(
    Object.entries(doc.steps).filter(([key]) => !key.startsWith('$')),
  );
  const rung = (name) => {
    if (!(name in steps)) {
      throw new Error(`emphasis references step "${name}", which tones.tokens.json does not define`);
    }
    return steps[name];
  };
  const emphasis = Object.fromEntries(
    Object.entries(doc.emphasis)
      .filter(([key]) => !key.startsWith('$'))
      .map(([name, jobs]) => [
        name,
        Object.fromEntries(Object.entries(jobs).map(([job, step]) => [job, rung(step)])),
      ]),
  );
  const { subtle, solid, outline, text } = emphasis;
  const entries = [];

  // A tone is a NAME for a scale; the emphasis map says which steps that scale
  // lends to each treatment. Roles come first so `primary` reads before `red`,
  // then the hues — matching TONE_NAMES' declaration order.
  const scaleOf = { ...roles };
  for (const hue of doc.hues) scaleOf[hue] = hue;
  const ordered = [...Object.keys(roles), ...doc.hues];

  for (const name of ordered) {
    const scale = scaleOf[name];
    for (const step of [subtle.bg, subtle.text, solid.bg, solid.text, outline.border]) {
      const token = `${scale}-${step}`;
      if (!(token in light)) {
        throw new Error(`tone "${name}" needs ${token}, which the ramps do not define`);
      }
    }
    entries.push(
      `  '${name}': {\n` +
        `    subtle: 'bg-${scale}-${subtle.bg} text-${scale}-${subtle.text}',\n` +
        `    solid: 'bg-${scale}-${solid.bg} text-${scale}-${solid.text}',\n` +
        `    outline: 'border-(length:--border-thick) border-${scale}-${outline.border} text-${scale}-${outline.text}',\n` +
        `    text: 'text-${scale}-${text.text}',\n` +
        `  },`,
    );
  }

  const names = ordered.map((n) => `'${n}'`).join(', ');
  const hueNames = doc.hues.map((n) => `'${n}'`).join(', ');
  // The two halves of TONE_NAMES, named. A role is a JOB (`danger`) that
  // resolves to whichever scale currently does it; a hue IS the scale
  // (`red`). Reaching for a hue where a role exists is how a redefinition
  // stops propagating, so the gallery lets you look at one half at a time.
  const roleNames = Object.keys(roles)
    .map((n) => `'${n}'`)
    .join(', ');
  // A tone name is not always a scale name (`primary` paints from `indigo`),
  // so any component building class strings by hand needs the mapping. `TONES`
  // bakes it into finished strings; this exposes it for the cases that can't
  // use those — a tone crossed with hover/active/focus, or with an opacity.
  const scaleEntries = ordered.map((n) => `  '${n}': '${scaleOf[n]}',`).join('\n');
  // The rung table itself. Components interpolate `bg-${scale}-${STEP.solid}`
  // rather than `bg-${scale}-9`, so re-anchoring a job stays a one-line edit in
  // tones.tokens.json instead of a sweep through every component.
  const stepEntries = Object.entries(steps)
    .map(([name, value]) => `  ${name}: ${typeof value === 'number' ? value : `'${value}'`},`)
    .join('\n');
  return (
    `// GENERATED by scripts/build-tokens.mjs from src/tokens/next/tones.tokens.json — do not edit.\n` +
    `// Literal class strings so Tailwind can scan them; see build-tokens.mjs emitTones().\n` +
    `export const TONE_NAMES = [${names}] as const;\n` +
    `export type Tone = (typeof TONE_NAMES)[number];\n` +
    `export const ROLE_TONES = [${roleNames}] as const;\n` +
    `export type RoleTone = (typeof ROLE_TONES)[number];\n` +
    `export const HUE_TONES = [${hueNames}] as const;\n` +
    `export type HueTone = (typeof HUE_TONES)[number];\n` +
    `export type ToneEmphasis = 'subtle' | 'solid' | 'outline' | 'text';\n` +
    `export const TONE_SCALE: Record<Tone, HueTone> = {\n` +
    scaleEntries +
    `\n};\n` +
    `export const STEP = {\n` +
    stepEntries +
    `\n} as const;\n` +
    `export const TONES: Record<Tone, Record<ToneEmphasis, string>> = {\n` +
    entries.join('\n') +
    `\n};\n`
  );
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
    throw new Error(`Marker not found in tokens.css: ${start}`);
  }
  const afterStart = startIdx + start.length;
  if (css.indexOf(start, afterStart) !== -1) {
    throw new Error(`Duplicate start marker found in tokens.css (corruption?): ${start}`);
  }
  const endIdx = css.indexOf(end, afterStart);
  if (endIdx === -1) {
    throw new Error(`Marker not found in tokens.css: ${end}`);
  }
  return css.slice(0, afterStart) + '\n' + body + indent + css.slice(endIdx);
}

function build() {
  const { light, dark } = resolveTokenMaps();
  const regions = emitInstrumentCss({ light, dark });

  let css = readFileSync(cssFile, 'utf8');
  for (const marker of MARKERS) {
    css = spliceRegion(css, marker, regions[marker.region]);
  }
  writeFileSync(cssFile, css, 'utf8');
  console.log(`Updated ${path.relative(process.cwd(), cssFile)}`);

  writeFileSync(tonesFile, emitTones({ light }), 'utf8');
  console.log(`Updated ${path.relative(process.cwd(), tonesFile)}`);
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  build();
}
