import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-expect-error — plain .mjs module without type declarations
import { diffAgainstBaseline, readBaseline } from '../../scripts/scan-hardcoded-values.mjs';

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

describe('readBaseline', () => {
  const dir = mkdtempSync(join(tmpdir(), 'baseline-'));

  it('returns the violations array from a valid baseline', () => {
    const file = join(dir, 'ok.json');
    writeFileSync(file, JSON.stringify({ violations: ['a::x', 'b::y'] }));
    expect(readBaseline(file)).toEqual(['a::x', 'b::y']);
  });

  it.each([
    ['missing file', join(dir, 'nope.json'), undefined],
    ['invalid json', join(dir, 'bad.json'), '{oops'],
    ['wrong shape', join(dir, 'shape.json'), JSON.stringify({ violations: [1, 2] })],
  ])('exits with an actionable message on %s', (_name, file, content) => {
    if (content !== undefined) writeFileSync(file, content);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit');
    });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => readBaseline(file)).toThrow('exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errSpy).toHaveBeenCalled();
    exitSpy.mockRestore();
    errSpy.mockRestore();
  });
});
