import { fileName, implPaths, joinPath } from './resolve-impl';

describe('implPaths', () => {
  it('defaults to the demo path with `.demo` dropped', () => {
    expect(implPaths('../pill.demo.tsx')).toEqual(['../pill.tsx']);
    expect(implPaths('../icons/icon.demo.tsx')).toEqual(['../icons/icon.tsx']);
    expect(implPaths('../ui/button.demo.tsx')).toEqual(['../ui/button.tsx']);
  });

  it('resolves a declared sibling relative to the demo, not the globbing module', () => {
    // Without the dirname() join this would resolve to `../registry.tsx` and
    // silently miss — the file lives next to the demo, one level down.
    expect(implPaths('../icons/icon.demo.tsx', './registry.tsx')).toEqual([
      '../icons/registry.tsx',
    ]);
  });

  it('resolves multiple declared files in order', () => {
    expect(implPaths('../icons/icon.demo.tsx', ['./icon.tsx', './registry.tsx'])).toEqual([
      '../icons/icon.tsx',
      '../icons/registry.tsx',
    ]);
  });

  it('keeps leading `..` segments, which are meaningful in glob keys', () => {
    expect(implPaths('../swatches.demo.tsx', '../shared/palette.ts')).toEqual([
      '../../shared/palette.ts',
    ]);
    expect(implPaths('../ui/button.demo.tsx', '../../lib/press.ts')).toEqual([
      '../../lib/press.ts',
    ]);
    expect(implPaths('../ui/button.demo.tsx', '../press.ts')).toEqual(['../press.ts']);
  });

  it('handles a `.ts` demo as well as `.tsx`', () => {
    expect(implPaths('../tones.demo.ts')).toEqual(['../tones.ts']);
  });
});

describe('joinPath', () => {
  it('normalizes `.` and `..` without collapsing leading `..`', () => {
    expect(joinPath('..', './a.tsx')).toBe('../a.tsx');
    expect(joinPath('../icons', '../pill.tsx')).toBe('../pill.tsx');
    expect(joinPath('..', '../a.tsx')).toBe('../../a.tsx');
    expect(joinPath('', './a.tsx')).toBe('a.tsx');
  });
});

describe('fileName', () => {
  it('returns the last segment', () => {
    expect(fileName('../icons/registry.tsx')).toBe('registry.tsx');
    expect(fileName('pill.tsx')).toBe('pill.tsx');
  });
});
