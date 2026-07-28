import { describe, it, expect } from 'vitest';
import {
  BORDERS,
  BREAKPOINTS,
  DURATIONS,
  EASINGS,
  FONT_WEIGHTS,
  LAYERS,
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
    const sizes = liveTokens(/^text-[a-z]+$/);
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
  it('folds line-height onto its size instead of listing it as one', () => {
    // `text` holds both `13` and `13--line-height`; only the sizes are sizes.
    expect(TEXT_SIZES).toHaveLength(10);
    expect(TEXT_SIZES.every((s) => s.value === `${s.step}px`)).toBe(true);
    expect(TEXT_SIZES.find((s) => s.step === '11')?.letterSpacing).toBe('.06em');
  });

  it('carries a leading for every rung except the one added for the sweep', () => {
    // 15 is the `lg` control rung six primitives had been spelling as
    // `text-[15px]`, which sets size alone. It ships without a leading so the
    // swap renders identically; pairing is a separate, visible decision.
    expect(TEXT_SIZES.filter((s) => !s.lineHeight).map((s) => s.step)).toEqual(['15']);
  });

  it('carries both theme values for the one family that has them', () => {
    expect(SHADOWS).toHaveLength(3);
    expect(SHADOWS.every((s) => s.light !== s.dark)).toBe(true);
  });

  it('exposes each remaining family at its documented size', () => {
    expect(RADII).toHaveLength(4);
    expect(FONT_WEIGHTS.map((w) => w.value)).toEqual(['400', '500', '600']);
    expect(DURATIONS).toHaveLength(3);
    expect(EASINGS).toHaveLength(2);
    expect(BORDERS).toHaveLength(2);
    expect(LAYERS).toHaveLength(3);
    expect(BREAKPOINTS).toHaveLength(2);
  });
});

describe('driftFor', () => {
  it('matches on value, not name — the proposal renames everything', () => {
    const rows = driftFor('t', [{ name: 'text-13', value: '13px' }], [{ name: 'text-ui', value: '13px' }]);
    expect(rows).toEqual([
      { family: 't', status: 'matched', spec: 'text-13', live: 'text-ui', value: '13px' },
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
  it('pins what the proposal actually costs the live sheet', () => {
    const byFamily = Object.fromEntries(drift().map((f) => [f.family, f.rows]));

    // Every proposed size exists in the sheet. The nine legacy NAMES also
    // still exist and are reported dropped — see the ratchet below.
    expect(byFamily.text?.filter((r) => r.status === 'added')).toEqual([]);

    // Radius is migrated: the six custom names are gone and the four steps now
    // resolve to Tailwind's own sm/md/lg/xl, which happen to be exactly
    // 4/6/8/12px. Nothing of ours is left in the sheet to drop.
    expect(byFamily.radius?.filter((r) => r.status === 'dropped')).toEqual([]);

    // Elevation now ships all three levels — the middle one was the addition.
    expect(byFamily.shadow?.filter((r) => r.status !== 'matched')).toEqual([]);

    // Motion has landed: durations and curves are named in the sheet now, so
    // every proposed one matches something live.
    expect(byFamily.duration?.every((r) => r.status === 'matched')).toBe(true);
    expect(byFamily.ease?.every((r) => r.status === 'matched')).toBe(true);
    expect(byFamily.animate?.every((r) => r.status === 'matched')).toBe(true);
  });

  it('reports exactly the legacy type names as still-live — the sweep ratchet', () => {
    // A dropped row means the sheet defines something the spec does not. That
    // is now true of precisely the nine role-named sizes, which stay until
    // their ~439 call sites move to the numeric scale and `--text-*: initial`
    // removes the utilities.
    //
    // Counted, not named: `driftFor` matches on VALUE, and right now each
    // legacy name shares its value with a numeric rung (`--text-label` and
    // `--text-11` are both 11px). So drift cannot say which of the pair is the
    // survivor — only that nine text values are defined twice. `text-15` is
    // the one rung with no legacy twin, which is why it is not in the count.
    //
    // This number only shrinks. At 0, delete the legacy block from tokens.css
    // and LEGACY_TEXT_SIZES from cn.ts — and this test with them.
    const dropped = drift().flatMap((f) => f.rows.filter((r) => r.status === 'dropped'));
    expect(dropped.every((r) => r.family === 'text')).toBe(true);
    expect(dropped).toHaveLength(9);
  });

  it('summarises to counts a page can lead with', () => {
    const summary = driftSummary();
    const rows = drift().flatMap((f) => f.rows).length;
    expect(summary.matched + summary.added + summary.dropped).toBe(rows);
    expect(summary.matched).toBeGreaterThan(0);
  });
});
