import { describe, it, expect } from 'vitest';
import {
  BORDERS,
  BREAKPOINTS,
  DURATIONS,
  EASINGS,
  FONT_WEIGHTS,
  LAYERS,
  RADII,
  RINGS,
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
    // `--shadow-raised: var(--ins-shadow-raised)` and --ins-shadow-raised is declared
    // twice — once per theme. Unresolved, both themes would read "var(...)".
    const light = liveTokens(/^shadow-raised$/)[0];
    const dark = liveTokens(/^shadow-raised$/, 'dark')[0];
    expect(light?.value).toMatch(/^0 /);
    expect(dark?.value).toMatch(/^0 /);
    expect(light?.value).not.toBe(dark?.value);
  });
});

describe('spec tokens', () => {
  it('is a closed scale of twelve rungs, each named for its own pixel size', () => {
    expect(TEXT_SIZES.map((s) => s.step)).toEqual([
      '9', '10', '11', '12', '13', '14', '15', '16', '18', '20', '22', '24',
    ]);
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

  it('carries both theme values for the one family that has them', () => {
    expect(SHADOWS).toHaveLength(3);
    expect(SHADOWS.every((s) => s.light !== s.dark)).toBe(true);
  });

  it('exposes each remaining family at its documented size', () => {
    expect(RADII.map((r) => r.name)).toEqual(['radius-sm', 'radius-md', 'radius-lg', 'radius-xl']);
    expect(FONT_WEIGHTS.map((w) => w.value)).toEqual(['400', '500', '600']);
    expect(DURATIONS.map((d) => d.name)).toEqual(['duration-120', 'duration-200', 'duration-320']);
    expect(EASINGS).toHaveLength(2);
    expect(BORDERS.map((b) => b.name)).toEqual(['border-1', 'border-2']);
    expect(RINGS.map((r) => r.name)).toEqual(['ring-3']);
    expect(LAYERS.map((l) => l.name)).toEqual(['z-10', 'z-40', 'z-50']);
    expect(BREAKPOINTS.map((b) => b.value)).toEqual(['640px', '768px', '1024px', '1280px', '1536px']);
  });
});

describe('the radius scale in the live sheet', () => {
  it('declares exactly the four rungs, at the spec values', () => {
    const rungs = liveTokens(/^radius-(sm|md|lg|xl)$/);
    expect(Object.fromEntries(rungs.map((r) => [r.name, r.value]))).toEqual({
      'radius-sm': '4px',
      'radius-md': '6px',
      'radius-lg': '8px',
      'radius-xl': '12px',
    });
  });

  it('clears the off-scale rungs so they cannot drift back', () => {
    const cleared = liveTokens(/^radius-(xs|2xl|3xl|4xl)$/);
    expect(cleared.map((r) => r.name).sort()).toEqual([
      'radius-2xl',
      'radius-3xl',
      'radius-4xl',
      'radius-xs',
    ]);
    expect(cleared.every((r) => r.value === 'initial')).toBe(true);
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
