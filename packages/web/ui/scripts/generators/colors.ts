import { readTokenFile } from './utils/read-token-file.ts';
import { assertThemeSymmetry, colorVars, splitThemes, themedSheet } from './utils/themed-sheet.ts';
import { constant, memberType, tsModule, tuple } from './utils/ts-module.ts';
import type { ColorsDoc, Family, Themed } from './utils/types.ts';

/**
 * Every colour the system paints with, plus the tone vocabulary derived from it.
 *
 * Three kinds of name live here because three kinds of thing are colours:
 *
 *   RAMPS — eleven perceptual scales. A ramp step IS the token: `gray-1` is the
 *   app background, `red-9` the solid fill. There is no primitive -> semantic
 *   alias layer; the step number carries that meaning directly.
 *
 *   SURFACES — defined by what they sit above, which no ramp step expresses.
 *   `surface-raised` is pure white in the light theme, and no gray rung is.
 *
 *   LITERALS — chosen for recognition rather than contrast. A highlighter is
 *   yellow. Deliberately few: each is a hole in the ramp discipline.
 *
 * The hue list is DERIVED from the ramps rather than declared. A hand-kept list
 * was a second copy of the ramp names that could disagree with them — a hue
 * listed but unpainted, or painted but unlisted. Ramp ORDER is key order in the
 * JSON; gray sits last because the neutral reads after the chromatics.
 */
export function generateColors(): Family {
  const doc = readTokenFile<ColorsDoc>('colors.tokens.json');

  assertRampsAreUniform(doc.ramp);
  assertRolesResolve(doc);

  // Flatten `gray: { 1: … }` to `gray-1`, which IS the custom-property name.
  // The nesting is for the author's eye: eleven ramps of thirteen rungs read as
  // a table rather than 143 sibling keys.
  const flat: Record<string, Themed> = {};
  for (const [ramp, steps] of Object.entries(doc.ramp)) {
    for (const [step, value] of Object.entries(steps)) flat[`${ramp}-${step}`] = value;
  }
  for (const [name, value] of Object.entries(doc.surface)) flat[`surface-${name}`] = value;
  for (const [name, value] of Object.entries(doc.literal)) flat[name] = value;

  const { light, dark } = splitThemes(flat);
  assertThemeSymmetry('colors', light, dark);

  const hues = Object.keys(doc.ramp);
  const roles = Object.keys(doc.role);
  const rampOf: Record<string, string> = { ...doc.role };
  for (const hue of hues) rampOf[hue] = hue;

  return {
    css: themedSheet({ light, dark, bridge: colorVars, clear: '--color-*: initial;' }),
    ts: tsModule({
      source: 'colors.tokens.json',
      summary:
        'The tone vocabulary and the resolved ramp values.\n' +
        '\n' +
        'A tone is a NAME for a ramp. Roles come first so `primary` reads before\n' +
        '`red`, then the hues. TONE_RAMP is named for what it RETURNS — a ramp\n' +
        'name, which goes straight into `bg-${…}-9`, never a tone name.',
      declarations: [
        tuple('TONE_NAMES', [...roles, ...hues]),
        memberType('Tone', 'TONE_NAMES'),
        tuple('ROLE_TONES', roles),
        memberType('RoleTone', 'ROLE_TONES'),
        tuple('HUE_TONES', hues),
        memberType('HueTone', 'HUE_TONES'),
        `export const TONE_RAMP: Record<Tone, HueTone> = ${JSON.stringify(
          Object.fromEntries([...roles, ...hues].map((n) => [n, rampOf[n]])),
          null,
          2,
        )};\n`,
        'export interface Themed { light: string; dark: string }\n',
        constant('RAMPS', doc.ramp, 'Record<string, Record<string, Themed>>'),
        constant('SURFACES', doc.surface, 'Record<string, Themed>'),
        constant('LITERALS', doc.literal, 'Record<string, Themed>'),
      ],
    }),
  };
}

/**
 * Every ramp carries the same rungs.
 *
 * Since a component spells its own rung at the call site, ANY rung is
 * reachable, so the useful invariant is that the ramps agree with each other. A
 * ramp missing step 3 makes `bg-teal-3` a class with no colour behind it —
 * invisible unless someone looks at that exact tone.
 */
function assertRampsAreUniform(ramp: ColorsDoc['ramp']): void {
  const entries = Object.entries(ramp);
  const [firstName, firstRamp] = entries[0] ?? [];
  if (!firstName || !firstRamp) throw new Error('colors.tokens.json defines no ramps');
  const expected = Object.keys(firstRamp);

  for (const [name, steps] of entries) {
    const got = Object.keys(steps);
    const missing = expected.filter((s) => !got.includes(s));
    const extra = got.filter((s) => !expected.includes(s));
    if (missing.length || extra.length) {
      throw new Error(
        `ramp "${name}" does not match "${firstName}": ` +
          [missing.length && `missing ${missing.join(', ')}`, extra.length && `unexpected ${extra.join(', ')}`]
            .filter(Boolean)
            .join('; '),
      );
    }
  }
}

/**
 * Every role points at a ramp that exists.
 *
 * The role map is the one indirection left — `danger` names a JOB and this says
 * which ramp currently does it. A role pointing somewhere unpainted would build
 * `bg-crimson-9`, a class with no colour.
 */
function assertRolesResolve(doc: ColorsDoc): void {
  for (const [role, ramp] of Object.entries(doc.role)) {
    if (!(ramp in doc.ramp)) {
      throw new Error(`role "${role}" resolves to ramp "${ramp}", which the ramps do not define`);
    }
  }
}
