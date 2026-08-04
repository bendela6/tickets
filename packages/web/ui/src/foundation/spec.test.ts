import { describe, it, expect } from 'vitest';
import radiusCss from '../../styles/generated/radius.css?raw';
import {
  BREAKPOINTS,
  DURATIONS,
  EASINGS,
  FONT_WEIGHTS,
  RADII,
  SHADOWS,
  TEXT_SIZES,
  drift,
  driftFor,
  driftSummary,
  liveTokens,
  parseCustomProperties,
} from './spec';

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
  it('reads the real sheet rather than a transcription of it', () => {
    // If tokens.css stops defining a type scale this fails, which is the
    // point — the views below claim to show what the app ships.
    const sizes = liveTokens(/^text-\d+$/);
    expect(sizes.length).toBeGreaterThan(0);
    expect(sizes.every((t) => /^\d+px$/.test(t.value))).toBe(true);
  });

  it('resolves one level of var() indirection, per theme', () => {
    // `--shadow-xs: var(--ins-shadow-xs)` and --ins-shadow-xs is declared
    // twice — once per theme. Unresolved, both themes would read "var(...)".
    const light = liveTokens(/^shadow-xs$/)[0];
    const dark = liveTokens(/^shadow-xs$/, 'dark')[0];
    expect(light?.value).toMatch(/^0 /);
    expect(dark?.value).toMatch(/^0 /);
    expect(light?.value).not.toBe(dark?.value);
  });
});

// Nothing here restates a token VALUE. A test that lists the twelve sizes or
// the four radius rungs has to be edited every time a token changes, and it
// proves only that someone copied the JSON correctly twice — it cannot fail for
// any reason worth knowing about. What is asserted instead are the contracts
// that survive a value change: naming rules, shapes, and what must NOT exist.

describe('spec tokens', () => {
  it('names every type rung for its own pixel size', () => {
    // The rule that makes the scale readable — `text-13` IS 13px. A new rung
    // added as `text-15: 16px` breaks this; adding `text-32: 32px` does not.
    expect(TEXT_SIZES.length).toBeGreaterThan(0);
    expect(TEXT_SIZES.every((s) => s.value === `${s.step}px`)).toBe(true);
  });

  it('carries nothing but a size — no rung bundles a leading or a tracking', () => {
    // A size token sets font-size and only font-size. Leading is stated at the
    // call site as `text-13/19`, tracking as `tracking-wider`, because one is
    // a function of the size and the other of the role, and neither is a
    // property of the token. The old scale bundled both and called it semantic.
    expect(TEXT_SIZES.some((s) => s.lineHeight)).toBe(false);
    expect(TEXT_SIZES.some((s) => s.letterSpacing)).toBe(false);
  });

  it('gives every shadow a different value per theme', () => {
    // A shadow that resolved the same in both themes would mean one of the two
    // files was never edited — the light theme tints, the dark one occludes.
    expect(SHADOWS.length).toBeGreaterThan(0);
    expect(SHADOWS.every((s) => s.light !== s.dark)).toBe(true);
  });
});

describe('the radius scale in the live sheet', () => {
  it('clears the whole namespace first, so off-scale rungs cannot drift back', () => {
    // Asserted against the raw text rather than `liveTokens`, which parses
    // `--name: value` and cannot see a `*` in the name.
    //
    // The wildcard replaced four named clears (xs/2xl/3xl/4xl) on 2026-08-04.
    // Same result for today's Tailwind, but it also catches any rung a future
    // version adds — the named list would have let that one through silently.
    expect(radiusCss).toMatch(/--radius-\*:\s*initial;/);
    expect(radiusCss.indexOf('--radius-*')).toBeLessThan(radiusCss.indexOf('--radius-sm'));
  });

  it('leaves rounded-full reachable, since Tailwind hardcodes it', () => {
    // `calc(infinity * 1px)`, not a token read — so the namespace clear above
    // cannot remove it, and a pill is not a step on the scale anyway.
    expect(radiusCss).not.toContain('--radius-full');
  });
});

describe('driftFor', () => {
  it('matches on value, not name — the proposal renames everything', () => {
    const rows = driftFor('t', [{ name: 'text-13', value: '13px' }], [{ name: 'text-13/19', value: '13px' }]);
    expect(rows).toEqual([
      { family: 't', status: 'matched', spec: 'text-13', live: 'text-13/19', value: '13px' },
    ]);
  });

  it('normalizes leading zeros so .06em and 0.06em are the same value', () => {
    const rows = driftFor('t', [{ name: 'a', value: '.06em' }], [{ name: 'b', value: '0.06em' }]);
    expect(rows[0]?.status).toBe('matched');
  });

  it('reports a proposed token with no live counterpart as added', () => {
    const rows = driftFor('t', [{ name: 'a', value: '7px' }], []);
    expect(rows[0]).toMatchObject({ status: 'added', spec: 'a', live: undefined });
  });

  it('reports a live token whose value nothing proposes as dropped', () => {
    const rows = driftFor('t', [], [{ name: 'b', value: '5px' }]);
    expect(rows[0]).toEqual({ family: 't', status: 'dropped', live: 'b', value: '5px' });
  });

  it('claims each live token once, so two spec tokens cannot share one match', () => {
    const rows = driftFor(
      't',
      [
        { name: 'a1', value: '4px' },
        { name: 'a2', value: '4px' },
      ],
      [{ name: 'b', value: '4px' }],
    );
    expect(rows.map((r) => r.status)).toEqual(['matched', 'added']);
  });
});

describe('drift', () => {
  it('covers only the families that are actually tokenized', () => {
    // Border, ring, z, duration and breakpoint are Tailwind-native now: the
    // value lives at the call site and nowhere else. Drift measures the gap
    // between two copies of a value, so a family with one copy has none to
    // measure, and listing it would report every rung as `dropped` forever.
    expect(drift().map((f) => f.family)).toEqual([
      'text',
      'radius',
      'shadow',
      'font',
      'font-weight',
      'ease',
      'animate',
    ]);
  });

  it('pins what the proposal actually costs the live sheet', () => {
    const byFamily = Object.fromEntries(drift().map((f) => [f.family, f.rows]));
    expect(byFamily.text?.filter((r) => r.status === 'added')).toEqual([]);
    // Radius is migrated: the four rungs resolve to Tailwind's own sm/md/lg/xl,
    // which are exactly 4/6/8/12px. Nothing of ours is left to drop.
    expect(byFamily.radius?.filter((r) => r.status !== 'matched')).toEqual([]);
    expect(byFamily.shadow?.filter((r) => r.status !== 'matched')).toEqual([]);
    expect(byFamily.ease?.every((r) => r.status === 'matched')).toBe(true);
    expect(byFamily.animate?.every((r) => r.status === 'matched')).toBe(true);
  });

  it('reports nothing dropped anywhere — the sheet defines only what the spec does', () => {
    // The sweep ratchet that used to live here counted the role-named sizes
    // still in the sheet. It reached zero, so it is gone and this is the
    // stronger claim in its place: a dropped row means the sheet defines
    // something the spec does not, and there is nothing left.
    const dropped = drift().flatMap((f) => f.rows.filter((r) => r.status === 'dropped'));
    expect(dropped.map((r) => r.live)).toEqual([]);
  });

  it('summarises to counts a page can lead with', () => {
    const summary = driftSummary();
    const rows = drift().flatMap((f) => f.rows).length;
    expect(summary.matched + summary.added + summary.dropped).toBe(rows);
    expect(summary.matched).toBeGreaterThan(0);
  });
});

describe('the un-tokenized families', () => {
  it('declares no border, ring, z, duration or breakpoint token', () => {
    // Tailwind's bare-value utilities already state these — `border-1` is 1px,
    // `z-10` is 10, `duration-200` is 200ms. A token would be a second place
    // for the value to live, which is the only way it could disagree.
    expect(liveTokens(/^(border|ring|z|duration|breakpoint)-/)).toEqual([]);
  });

  it('keeps the easings, which have no numeric form', () => {
    expect(liveTokens(/^ease-/).map((t) => t.name).sort()).toEqual(['ease-in-out', 'ease-out']);
  });
});
