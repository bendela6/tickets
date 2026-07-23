// The scanner is an .mjs script; the pure baseline-diff helper is exported
// for testing. vitest resolves the relative import fine.
// @ts-expect-error — plain .mjs module without type declarations
import { diffAgainstBaseline } from '../scripts/scan-hardcoded-values.mjs';

describe('diffAgainstBaseline', () => {
  const baseline = ['a.css::color: #fff', 'b.tsx::bg-[#123456]'];

  it('flags violations not present in the baseline', () => {
    const { fresh } = diffAgainstBaseline(['a.css::color: #fff', 'c.tsx::#abc'], baseline);
    expect(fresh).toEqual(['c.tsx::#abc']);
  });

  it('reports baseline entries that no longer occur (ratchet progress)', () => {
    const { fixed } = diffAgainstBaseline(['a.css::color: #fff'], baseline);
    expect(fixed).toEqual(['b.tsx::bg-[#123456]']);
  });

  it('is clean when violations exactly match the baseline', () => {
    const { fresh, fixed } = diffAgainstBaseline([...baseline], baseline);
    expect(fresh).toEqual([]);
    expect(fixed).toEqual([]);
  });
});
