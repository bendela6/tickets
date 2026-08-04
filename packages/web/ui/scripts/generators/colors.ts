import { readTokenFile } from './utils/read-token-file.ts';
import { assertThemeSymmetry, colorVars, themedSheet } from './utils/themed-sheet.ts';
import { constant, memberType, tsModule, tuple } from './utils/ts-module.ts';
import type { ColorTheme, ColorsDoc, Family, TokenMap } from './utils/types.ts';

/**
 * Every colour the system paints with, plus the tone vocabulary derived from it.
 *
 * Three kinds of name live here because three kinds of thing are colours:
 *
 *   HUES — eleven perceptual scales. A step IS the token: `gray-1` is the app
 *   background, `red-9` the solid fill. There is no primitive -> semantic alias
 *   layer; the step number carries that meaning directly, and means the same
 *   job on every hue.
 *
 *   SURFACES — defined by what they sit above, which no step expresses.
 *   `surface-raised` is pure white in the light theme, and no gray step is.
 *
 *   LITERALS — chosen for recognition rather than contrast. A highlighter is
 *   yellow. Deliberately few: each is a hole in the hue discipline.
 *
 * The hue LIST is derived from the token file's keys rather than declared
 * separately. A hand-kept list was a second copy of the names that could
 * disagree with the colours themselves — a hue listed but unpainted, or painted
 * but unlisted. Order is key order in the JSON; gray sits last because the
 * neutral reads after the chromatics.
 */
export function generateColors(): Family {
  const doc = readTokenFile<ColorsDoc>('colors.tokens.json');

  assertHuesAreUniform(doc);
  assertRolesResolve(doc);

  // Flatten `gray: { 1: … }` to `gray-1`, which IS the custom-property name.
  // The nesting is for the author's eye: eleven hues of thirteen steps read as
  // a table rather than 143 sibling keys.
  const flatten = (theme: ColorTheme): TokenMap => {
    const map: TokenMap = {};
    for (const [hue, steps] of Object.entries(theme.hue)) {
      for (const [step, value] of Object.entries(steps)) map[`${hue}-${step}`] = value;
    }
    for (const [name, value] of Object.entries(theme.surface)) map[`surface-${name}`] = value;
    for (const [name, value] of Object.entries(theme.literal)) map[name] = value;
    return map;
  };

  const light = flatten(doc.light);
  const dark = flatten(doc.dark);
  assertThemeSymmetry('colors', light, dark);

  const hues = Object.keys(doc.light.hue);
  const roles = Object.keys(doc.role);
  const hueOf: Record<string, string> = { ...doc.role };
  for (const hue of hues) hueOf[hue] = hue;

  return {
    css: themedSheet({ light, dark, bridge: colorVars, clear: '--color-*: initial;' }),
    ts: tsModule({
      source: 'colors.tokens.json',
      summary:
        'The tone vocabulary and the resolved colour tables.\n' +
        '\n' +
        'A tone is a NAME for a hue. Roles come first so `primary` reads before\n' +
        '`red`, then the hues. TONE_HUE is named for what it RETURNS — a hue\n' +
        'name, which goes straight into `bg-${…}-9`, never a tone name.',
      declarations: [
        tuple('TONE_NAMES', [...roles, ...hues]),
        memberType('Tone', 'TONE_NAMES'),
        tuple('ROLES', roles),
        memberType('Role', 'ROLES'),
        tuple('HUES', hues),
        memberType('Hue', 'HUES'),
        `export const TONE_HUE: Record<Tone, Hue> = ${JSON.stringify(
          Object.fromEntries([...roles, ...hues].map((n) => [n, hueOf[n]])),
          null,
          2,
        )};\n`,
        tuple('STEPS', Object.keys(doc.light.hue[hues[0]!]!)),
        'export interface ColorTheme {\n' +
          '  hue: Record<string, Record<string, string>>;\n' +
          '  surface: Record<string, string>;\n' +
          '  literal: Record<string, string>;\n' +
          '}\n',
        constant(
          'PALETTE',
          { light: doc.light, dark: doc.dark },
          'Record<"light" | "dark", ColorTheme>',
        ),
      ],
    }),
  };
}

/**
 * Every hue carries the same steps, in both themes.
 *
 * Since a component spells its own step at the call site, ANY step is
 * reachable, so the useful invariant is that the hues agree with each other. A
 * hue missing step 3 makes `bg-teal-3` a class with no colour behind it —
 * invisible unless someone looks at that exact tone.
 *
 * Theme-at-root makes this check matter more than it did: the two blocks are
 * now ~300 lines apart, so a step added to one and not the other is easy to
 * miss by eye and impossible to miss here.
 */
function assertHuesAreUniform(doc: ColorsDoc): void {
  const entries = Object.entries(doc.light.hue);
  const [firstName, firstHue] = entries[0] ?? [];
  if (!firstName || !firstHue) throw new Error('colors.tokens.json defines no hues');
  const expected = Object.keys(firstHue);

  for (const theme of ['light', 'dark'] as const) {
    for (const [name, steps] of Object.entries(doc[theme].hue)) {
      const got = Object.keys(steps);
      const missing = expected.filter((s) => !got.includes(s));
      const extra = got.filter((s) => !expected.includes(s));
      if (missing.length || extra.length) {
        throw new Error(
          `${theme} hue "${name}" does not match "${firstName}": ` +
            [missing.length && `missing ${missing.join(', ')}`, extra.length && `unexpected ${extra.join(', ')}`]
              .filter(Boolean)
              .join('; '),
        );
      }
    }
  }
}

/**
 * Every role points at a hue that exists.
 *
 * The role map is the one indirection left — `danger` names a JOB and this says
 * which hue currently does it. A role pointing somewhere unpainted would build
 * `bg-crimson-9`, a class with no colour.
 */
function assertRolesResolve(doc: ColorsDoc): void {
  for (const [role, hue] of Object.entries(doc.role)) {
    if (!(hue in doc.light.hue)) {
      throw new Error(`role "${role}" resolves to hue "${hue}", which the colours do not define`);
    }
  }
}
