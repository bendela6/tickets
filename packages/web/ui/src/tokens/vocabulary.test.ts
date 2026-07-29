import { RETIRED, scanBorderAgainstBaseline, scanRetired } from './vocabulary';

describe('RETIRED patterns', () => {
  it('matches an arbitrary radius but not a rung on the scale', () => {
    expect('rounded-[7px]'.match(RETIRED.radius)).toEqual(['rounded-[7px]']);
    expect('rounded-lg'.match(RETIRED.radius)).toBeNull();
  });

  it('matches the off-scale rungs cleared to initial', () => {
    expect('rounded-xs rounded-2xl'.match(RETIRED.radius)).toEqual(['rounded-xs', 'rounded-2xl']);
  });

  it('matches a bare width utility but never a border COLOUR', () => {
    expect(' border '.match(RETIRED.border)).toEqual(['border']);
    expect(' border-b '.match(RETIRED.border)).toEqual(['border-b']);
    expect(' border-gray-6 '.match(RETIRED.border)).toBeNull();
    expect(' border-1 '.match(RETIRED.border)).toBeNull();
  });

  it('matches 1.5px but not an integer width', () => {
    expect('border-[1.5px]'.match(RETIRED.border)).toEqual(['border-[1.5px]']);
    expect(' border-2 '.match(RETIRED.border)).toBeNull();
  });

  it('never matches the 1.5px form as a substring of a longer identifier', () => {
    // The 1.5px alternative had no left-boundary guard, unlike the bare-word
    // alternative right above it — `xborder-[1.5px]` (an identifier that
    // happens to end in the retired form) would have matched.
    expect('xborder-[1.5px]'.match(RETIRED.border)).toBeNull();
  });

  it('matches the off-ladder z rungs but not the ladder', () => {
    expect('z-3 z-30'.match(RETIRED.z)).toEqual(['z-3', 'z-30']);
    expect('z-10 z-40 z-50'.match(RETIRED.z)).toBeNull();
  });

  it('matches both retired ring forms but never as a substring of a longer identifier', () => {
    expect('ring-[3px]'.match(RETIRED.ring)).toEqual(['ring-[3px]']);
    expect('ring-(length:--ring-focus)'.match(RETIRED.ring)).toEqual([
      'ring-(length:--ring-focus)',
    ]);
    // No left-boundary guard originally, so a comment quoting the retired
    // form in prose (`ramp.ts`'s old JSDoc) matched it exactly like a real
    // class site — this is what closes that gap.
    expect('notring-[3px]'.match(RETIRED.ring)).toBeNull();
  });
});

describe('scanRetired', () => {
  it('has no bare border width utility outside the reviewed baseline', () => {
    // `RETIRED.border` can't tell a class string from prose, a comment, or a
    // data/enum literal — `border-baseline.json` is the reviewed list of
    // matches confirmed not to be a Tailwind class (see vocabulary.ts's
    // `scanBorderAgainstBaseline`). Anything outside it is a real, unswept
    // bare-border site.
    expect(scanBorderAgainstBaseline().fresh).toEqual([]);
  });

  it('never lets the border baseline rot into stale excuses', () => {
    // The ratchet: every baseline entry must still correspond to a real,
    // current line — if a baselined line changes shape (or disappears), it
    // shows up as `fixed` and the baseline needs pruning, not preserving.
    // This is what stops the baseline from silently growing wrong: it can
    // only ever shrink.
    expect(scanBorderAgainstBaseline().fixed).toEqual([]);
  });

  it('has no retired ring form left in scope', () => {
    expect(scanRetired('ring')).toEqual([]);
  });

  it('has no off-ladder z-index left in scope', () => {
    expect(scanRetired('z')).toEqual([]);
  });

  it('never reports a file under apps/eer — that app owns its own scale', () => {
    const all = (['radius', 'border', 'ring', 'z'] as const).flatMap(scanRetired);
    expect(all.filter((h) => h.startsWith('apps/eer'))).toEqual([]);
  });

  it('has no retired radius form anywhere in scope', () => {
    expect(scanRetired('radius')).toEqual([]);
  });
});
