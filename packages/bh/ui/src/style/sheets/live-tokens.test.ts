import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { compile } from 'tailwindcss';
import borderCss from '../../../styles/generated/border.css?raw';
import { PALETTE, TEXT_SIZES, TONE_NAMES, TONE_HUE, HUES, ROLES } from '../generated';
import { liveTokens, parseCustomProperties } from './live-tokens';

// Nothing here restates a token VALUE. A test listing the twelve type sizes or
// the six sanctioned radii has to be edited whenever a designer changes one, and
// can only fail if the JSON was copied wrong twice — it detects change, not
// breakage. What is asserted are the contracts that survive a value change:
// naming rules, shapes, and what must NOT exist.

/**
 * One utility's declarations, as STOCK Tailwind compiles them — no sheet of ours
 * in the input.
 *
 * The width utilities are redefinitions of Tailwind's own, so the only
 * trustworthy statement of what they should contain is the one Tailwind
 * produces. Transcribing it into an assertion would create the second copy this
 * file exists to avoid.
 */
async function coreRule(candidate: string): Promise<string> {
  const entry = createRequire(import.meta.url).resolve('tailwindcss/index.css');
  const base = dirname(entry);
  const compiler = await compile('@import "tailwindcss";', {
    base,
    loadStylesheet: async (id, from) => {
      const file = id === 'tailwindcss' ? entry : resolve(id.startsWith('.') ? from : base, id);
      return { path: file, base: dirname(file), content: readFileSync(file, 'utf8') };
    },
  });
  const css = compiler.build([candidate]);
  return new RegExp(`\\.${candidate}\\s*\\{([^{}]*)\\}`).exec(css)?.[1] ?? '';
}

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
    // point — the docs' token tables claim to show what the app ships.
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
    for (const tone of TONE_NAMES) {
      expect(HUES).toContain(TONE_HUE[tone]);
    }
  });

  it('maps every hue onto itself', () => {
    // A hue IS the scale, so the mapping has to be the identity there — a hue
    // that redirected would make `tone="red"` paint something other than red.
    for (const hue of HUES) {
      expect(TONE_HUE[hue]).toBe(hue);
    }
  });

  it('gives every hue the same steps, in both themes', () => {
    // A hue missing a step makes `bg-teal-3` a class with no colour. Theme-at-root
    // puts the two blocks ~300 lines apart, so this is the only thing that sees
    // a step added to one and not the other.
    const firstHue = Object.values(PALETTE.light.hue)[0];
    if (!firstHue) {
      throw new Error('PALETTE.light.hue has no hues to compare against');
    }
    const expected = Object.keys(firstHue).join(',');
    for (const theme of ['light', 'dark'] as const) {
      for (const [name, steps] of Object.entries(PALETTE[theme].hue)) {
        expect(`${theme}.${name}: ${Object.keys(steps).join(',')}`).toBe(
          `${theme}.${name}: ${expected}`,
        );
      }
    }
  });
});

describe('the radius scale in the live sheet', () => {
  it('clears the whole namespace and declares no rung of its own', () => {
    // Asserted against the raw text rather than `liveTokens`, which parses
    // `--name: value` and cannot see a `*` in the name.
    //
    // The wildcard replaced four named clears (xs/2xl/3xl/4xl). Same result for
    // today's Tailwind, but it also catches any rung a future version adds.
    expect(borderCss).toMatch(/--radius-\*:\s*initial;/);
    // Nothing may be declared back over the clear. A named rung here would be a
    // second spelling for a size the class already states — the two could then
    // disagree, which is the whole reason the t-shirt ladder was retired.
    expect(borderCss).not.toMatch(/--radius-(?!\*)[\w-]+\s*:/);
    expect(liveTokens(/^radius-/)).toEqual([]);
  });

  it('defines the radius utility over the cleared namespace', () => {
    // `rounded-6` is 6px because the class says so — Tailwind's stock utility
    // reads `--radius-*` and has no bare-value form, so with the namespace
    // cleared it would compile to nothing without this.
    expect(borderCss).toMatch(/@utility rounded-\* \{[^}]*--value\(number\)/);
  });

  it('takes fractions everywhere or nowhere, never one family and not the next', () => {
    // Radius was integer-only until the width utilities learned fractions on
    // 2026-08-08. One rule across the edge families is the point: a `border-1.5`
    // that works beside a `rounded-4.5` that silently does not is worse than
    // either answer, because nothing tells you which family you are in.
    expect(borderCss).not.toContain('--value(integer)');
    const utilities = [...borderCss.matchAll(/@utility ([\w-]+)-\* \{/g)].map((m) => m[1]);
    expect(utilities.length).toBeGreaterThan(0);
    for (const name of utilities) {
      const body = new RegExp(`@utility ${name}-\\* \\{([^}]*)\\}`).exec(borderCss)?.[1];
      expect(`${name}: ${body?.includes('--value(number)')}`).toBe(`${name}: true`);
    }
  });

  it('defines every corner utility, not just the all-corners one', () => {
    // A missing corner is invisible: `rounded-tr-8` would compile to nothing and
    // the corner would stay square, with no error anywhere. Asserted as a set
    // rather than by value, so a redrawn scale does not touch this test.
    const corners = ['s', 'e', 't', 'r', 'b', 'l', 'ss', 'se', 'ee', 'es', 'tl', 'tr', 'br', 'bl'];
    for (const corner of corners) {
      expect(borderCss).toContain(`@utility rounded-${corner}-* {`);
    }
  });

  it('leaves rounded-full reachable, since Tailwind hardcodes it', () => {
    // `calc(infinity * 1px)`, not a token read — so neither the namespace clear
    // nor the redefinition can remove it, and a pill is not a step on the scale
    // anyway. Same for `rounded-none`, which is a static `0`.
    expect(borderCss).not.toContain('--radius-full');
    expect(borderCss).not.toContain('@utility rounded-full');
    expect(borderCss).not.toContain('@utility rounded-none');
  });
});

describe('the width utilities in the live sheet', () => {
  it('defines every edge, so no side is left rejecting fractions', () => {
    // `border-t-1.5` compiling to nothing while `border-1.5` works is the same
    // silent failure the corner utilities have — the class is right there in the
    // DOM with no rule behind it. Asserted as a set, not by value.
    const edges = ['border', 'border-x', 'border-y', 'border-s', 'border-e'];
    const sides = ['border-t', 'border-r', 'border-b', 'border-l'];
    for (const name of [...edges, ...sides, 'outline', 'ring']) {
      expect(borderCss).toContain(`@utility ${name}-* {`);
    }
  });

  it('gives every var() an inline fallback', () => {
    // THE trap of the width half. Tailwind registers `--tw-border-style` and the
    // ring chain through `@property`, but only when one of ITS utilities is in
    // the bundle. A page using `border-1.5` and no core border class gets no
    // registration, the `var()` resolves to nothing, the declaration is dropped,
    // and the border silently does not paint. Every reference must carry its own
    // default so the utility stands alone.
    //
    // Two legitimately have nothing to default to: `--tw-ring-inset` takes an
    // empty fallback (`var(--tw-ring-inset,)`), and `--tw-ring-shadow` is
    // declared by the same rule one line above the reference.
    const SELF_SUPPLIED = ['--tw-ring-shadow', '--tw-ring-inset'];
    const noFallback = [...borderCss.matchAll(/var\((--tw-[\w-]+)\)/g)]
      .map((m) => m[1])
      .filter((name) => name !== undefined);
    expect(noFallback.filter((name) => !SELF_SUPPLIED.includes(name))).toEqual([]);
  });

  it('keeps the ring chain in step with the one Tailwind composes', async () => {
    // The one definition here that copies Tailwind INTERNALS rather than a CSS
    // property name: the box-shadow chain and the custom properties it layers.
    // If a future version adds a layer or renames one, our copy would keep
    // compiling and quietly paint the wrong thing.
    //
    // So the expectation is COMPILED from Tailwind rather than transcribed —
    // transcribing is what creates a second copy that can disagree. Compared as
    // the ordered list of custom properties referenced, which is
    // value-independent: it survives a rung change and fails on a recomposed
    // chain. Widths and fallbacks differ by design and are not compared.
    const referenced = (css: string): string[] => {
      return [...css.matchAll(/var\((--tw-[\w-]+)/g)]
        .map((m) => m[1])
        .filter((name) => name !== undefined);
    };
    const declarations = (css: string): string[] => {
      return [...css.matchAll(/(?:^|;)\s*([\w-]+)\s*:/g)]
        .map((m) => m[1])
        .filter((name) => name !== undefined);
    };

    const core = await coreRule('ring-2');
    const ours = /@utility ring-\* \{([^}]*)\}/.exec(borderCss)?.[1];
    // Both sides must be non-empty, or this compares two empty lists and passes
    // while measuring nothing — the failure mode of every test that extracts
    // with a regex.
    expect(core).toContain('box-shadow');
    expect(ours).toContain('box-shadow');
    expect(referenced(core).length).toBeGreaterThan(4);

    if (ours === undefined) {
      throw new Error('the @utility ring-* block did not match');
    }
    expect(referenced(ours)).toEqual(referenced(core));
    expect(declarations(ours)).toEqual(declarations(core));
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
