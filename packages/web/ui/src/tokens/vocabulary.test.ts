import { RETIRED, scanRetired } from './vocabulary';

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

  it('matches the off-ladder z rungs but not the ladder', () => {
    expect('z-3 z-30'.match(RETIRED.z)).toEqual(['z-3', 'z-30']);
    expect('z-10 z-40 z-50'.match(RETIRED.z)).toBeNull();
  });
});

describe('scanRetired', () => {
  it('walks real files rather than an empty tree', () => {
    // `border` is not swept until Task 6, so this is a live tree with hits in it.
    expect(scanRetired('border').length).toBeGreaterThan(0);
  });

  it('never reports a file under apps/eer — that app owns its own scale', () => {
    const all = (['radius', 'border', 'ring', 'z'] as const).flatMap(scanRetired);
    expect(all.filter((h) => h.startsWith('apps/eer'))).toEqual([]);
  });

  it('has no retired radius form anywhere in scope', () => {
    expect(scanRetired('radius')).toEqual([]);
  });
});
