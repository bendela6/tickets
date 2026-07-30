import { RETIRED, scanAgainstBaseline, scanRetired } from './vocabulary';

describe('RETIRED patterns', () => {
  it('matches an arbitrary radius but not a rung on the scale', () => {
    expect('rounded-[7px]'.match(RETIRED.radius)).toEqual(['rounded-[7px]']);
    expect('rounded-lg'.match(RETIRED.radius)).toBeNull();
  });

  it('matches the off-scale rungs cleared to initial', () => {
    expect('rounded-xs rounded-2xl'.match(RETIRED.radius)).toEqual(['rounded-xs', 'rounded-2xl']);
  });

  it('matches bare rounded and a bare side, but never a rung on the scale', () => {
    // Bare `rounded` (and `rounded-t`/`-r`/`-b`/`-l`/corner forms) resolves to
    // Tailwind's static 0.25rem default and was invisible to the pattern
    // before this case existed — the pattern required a `-<rung>` or
    // `-[…]` suffix, so a truly bare class never matched anything.
    expect('rounded'.match(RETIRED.radius)).toEqual(['rounded']);
    expect('rounded-t'.match(RETIRED.radius)).toEqual(['rounded-t']);
    // A scale rung must still never match, bare or side-qualified — `sm` is
    // two lowercase letters just like the `tl`/`tr`/`bl`/`br` corner
    // suffixes, which is exactly the ambiguity a generic `[a-z]{1,2}` side
    // group would fall into.
    expect('rounded-sm'.match(RETIRED.radius)).toBeNull();
    expect('rounded-t-lg'.match(RETIRED.radius)).toBeNull();
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

  it('matches a bare width utility behind a state variant like disabled:', () => {
    // `disabled:border` is a real, functional Tailwind class (the switch
    // track's disabled-only hairline) — the boundary excluded `:` so this
    // slipped past the scanner while `safelist.generated.css` still emitted
    // the rule for it. Trailing space, like the plain bare-word case above,
    // gives the lookahead a boundary character to match against.
    expect('disabled:border '.match(RETIRED.border)).toEqual(['border']);
    // A coloured/width-qualified class behind the same variant must still
    // never match.
    expect('disabled:border-gray-6 '.match(RETIRED.border)).toBeNull();
    expect('disabled:border-1 '.match(RETIRED.border)).toBeNull();
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
  // All four of these walk every .ts/.tsx file under all three ROOTS from
  // disk (`collectHits` re-reads the whole tree per call, uncached) — on
  // Windows, under parallel test-file contention, that has intermittently
  // exceeded vitest's 5000ms default. A flaky gate is a disabled gate, and
  // these are the only things enforcing the border and radius baselines, so
  // each gets an explicit, generous timeout rather than a shorter implicit
  // one.
  const BASELINE_SCAN_TIMEOUT_MS = 20_000;

  it('has no bare border width utility outside the reviewed baseline', () => {
    // `RETIRED.border` can't tell a class string from prose, a comment, or a
    // data/enum literal — `border-baseline.json` is the reviewed list of
    // matches confirmed not to be a Tailwind class (see vocabulary.ts's
    // `scanAgainstBaseline`). Anything outside it is a real, unswept
    // bare-border site.
    expect(scanAgainstBaseline('border').fresh).toEqual([]);
  }, BASELINE_SCAN_TIMEOUT_MS);

  it('never lets the border baseline rot into stale excuses', () => {
    // The ratchet: every baseline entry must still correspond to a real,
    // current line — if a baselined line changes shape (or disappears), it
    // shows up as `fixed` and the baseline needs pruning, not preserving.
    // This is what stops the baseline from silently growing wrong: it can
    // only ever shrink.
    expect(scanAgainstBaseline('border').fixed).toEqual([]);
  }, BASELINE_SCAN_TIMEOUT_MS);

  it('has no bare rounded/identifier collision outside the reviewed baseline', () => {
    // `RETIRED.radius`'s bare-`rounded` alternative can't tell a class string
    // from the English word "rounded" or a local identifier like
    // `const rounded = …` — `radius-baseline.json` is the reviewed list of
    // matches confirmed not to be a Tailwind class. Anything outside it is a
    // real, unswept bare-radius site. Reviewed non-matches get baselined,
    // never rewritten: reworking correct prose or renaming a working
    // variable just to appease the scanner inverts the relationship between
    // the tool and the code it's meant to serve.
    expect(scanAgainstBaseline('radius').fresh).toEqual([]);
  }, BASELINE_SCAN_TIMEOUT_MS);

  it('never lets the radius baseline rot into stale excuses', () => {
    expect(scanAgainstBaseline('radius').fixed).toEqual([]);
  }, BASELINE_SCAN_TIMEOUT_MS);

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
});
