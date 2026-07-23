import { SWATCHES } from './swatches';

describe('SWATCHES', () => {
  it('derives the six color-picker presets from light-theme tokens', () => {
    // Exactly the array previously hardcoded in types-tab.tsx / workflow-tab.tsx —
    // asserted literally so a token rebrand consciously updates this test.
    expect(SWATCHES).toEqual(['#4E46C6', '#2E7D4F', '#C25425', '#A03028', '#2E6FCC', '#79756A']);
  });
});
