import { describe, it, expect } from 'vitest';
import borderCss from '../../styles/generated/border.css?raw';
import { PALETTE, TEXT_SIZES, TONE_NAMES, TONE_HUE, HUES, ROLES } from '../generated';
import { liveTokens, parseCustomProperties } from './spec';

// Nothing here restates a token VALUE. A test listing the twelve type sizes or
// the four radius rungs has to be edited whenever a designer changes one, and
// can only fail if the JSON was copied wrong twice — it detects change, not
// breakage. What is asserted are the contracts that survive a value change:
// naming rules, shapes, and what must NOT exist.

describe('parseCustomProperties', () => {
  it('collects declarations in source order, keeping both theme values', () => {
    const css = `:root { --a: 1px; --b: red; } [data-theme='dark'] { --b: blue; }`;
    const parsed = parseCustomProperties(css);
    expect(parsed.get('a')).toEqual(['1px']);
    expect(parsed.get('b')).toEqual(['red', 'blue']);
  });

  it('ignores ordinary declarations', () => {
    const parsed = parseCustomProperties(`.x { border-radius: 5px; --radius-ctrl: 5px; }`);
    expect([...parsed.keys()]).toEqual(['radius-ctrl']);
  });
});

describe('liveTokens', () => {
  it('reads the real sheets rather than a transcription of them', () => {
    // If the generated CSS stops defining a type scale this fails, which is the
    // point — the gallery pages claim to show what the app ships.
    const sizes = liveTokens(/^text-\d+$/);
    expect(sizes.length).toBeGreaterThan(0);
    expect(sizes.every((t) => /^\d+px$/.test(t.value))).toBe(true);
  });

  it('resolves one level of var() indirection, per theme', () => {
    // `--shadow-xs: var(--ins-shadow-xs)`, and --ins-shadow-xs is declared
    // twice — once per theme. Unresolved, both themes would read "var(...)".
    const light = liveTokens(/^shadow-xs$/)[0];
    const dark = liveTokens(/^shadow-xs$/, 'dark')[0];
    expect(light?.value).toMatch(/^0 /);
    expect(dark?.value).toMatch(/^0 /);
    expect(light?.value).not.toBe(dark?.value);
  });
});

describe('the generated vocabulary', () => {
  it('names every type rung for its own pixel size', () => {
    // The rule that makes the scale readable — `text-13` IS 13px. Adding
    // `text-32: 32px` keeps this true; `text-15: 16px` breaks it.
    expect(TEXT_SIZES.length).toBeGreaterThan(0);
    for (const step of TEXT_SIZES) {
      expect(liveTokens(new RegExp(`^text-${step}$`))[0]?.value).toBe(`${step}px`);
    }
  });

  it('splits the tone names in two with nothing lost or counted twice', () => {
    expect([...ROLES, ...HUES]).toEqual([...TONE_NAMES]);
  });

  it('resolves every tone onto a hue that exists', () => {
    // A tone pointing outside HUES would build `bg-crimson-9` — a class
    // with no colour behind it.
    for (const tone of TONE_NAMES) expect(HUES).toContain(TONE_HUE[tone]);
  });

  it('maps every hue onto itself', () => {
    // A hue IS the scale, so the mapping has to be the identity there — a hue
    // that redirected would make `tone="red"` paint something other than red.
    for (const hue of HUES) expect(TONE_HUE[hue]).toBe(hue);
  });

  it('gives every hue the same steps, in both themes', () => {
    // A hue missing a step makes `bg-teal-3` a class with no colour. Theme-at-root
    // puts the two blocks ~300 lines apart, so this is the only thing that sees
    // a step added to one and not the other.
    const expected = Object.keys(Object.values(PALETTE.light.hue)[0]!).join(',');
    for (const theme of ['light', 'dark'] as const) {
      for (const [name, steps] of Object.entries(PALETTE[theme].hue)) {
        expect(`${theme}.${name}: ${Object.keys(steps).join(',')}`).toBe(`${theme}.${name}: ${expected}`);
      }
    }
  });
});

describe('the radius scale in the live sheet', () => {
  it('clears the whole namespace first, so off-scale rungs cannot drift back', () => {
    // Asserted against the raw text rather than `liveTokens`, which parses
    // `--name: value` and cannot see a `*` in the name.
    //
    // The wildcard replaced four named clears (xs/2xl/3xl/4xl). Same result for
    // today's Tailwind, but it also catches any rung a future version adds.
    expect(borderCss).toMatch(/--radius-\*:\s*initial;/);
    // The clear must precede the first real rung, or it would wipe them too.
    const firstRung = /--radius-(?!\*)[a-z0-9]+:/.exec(borderCss);
    expect(firstRung).not.toBeNull();
    expect(borderCss.indexOf('--radius-*')).toBeLessThan(firstRung!.index);
  });

  it('leaves rounded-full reachable, since Tailwind hardcodes it', () => {
    // `calc(infinity * 1px)`, not a token read — so the namespace clear cannot
    // remove it, and a pill is not a step on the scale anyway.
    expect(borderCss).not.toContain('--radius-full');
  });
});

describe('the un-tokenized families', () => {
  it('declares no border, ring, z or duration token', () => {
    // Measured: Tailwind has no namespace for any of these, so `border-7`,
    // `ring-42` and `z-999` all compile. Emitting a token would create a second
    // copy of a value the class already states — the only way they could
    // disagree.
    expect(liveTokens(/^(border|ring|z|duration)-/)).toEqual([]);
  });

  it('DOES declare breakpoints, which Tailwind does read from the theme', () => {
    // The one of the four that can be authoritative. Emitted in rem so a reader
    // who raises their default font size still gets the layout change.
    const rungs = liveTokens(/^breakpoint-/);
    expect(rungs.length).toBeGreaterThan(0);
    expect(rungs.every((r) => r.value.endsWith('rem'))).toBe(true);
  });
});
