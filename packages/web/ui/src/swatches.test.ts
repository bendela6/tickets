import { SWATCHES } from './swatches';

describe('SWATCHES', () => {
  it('derives the six color-picker presets from light-theme tokens', () => {
    // Exactly the array previously hardcoded in types-tab.tsx / workflow-tab.tsx —
    // asserted literally so a token rebrand consciously updates this test.
    // Post-Task-6 (the per-status color tokens retired): green/orange/blue now
    // come from the hue palette (opt-green/opt-orange/opt-blue) instead.
    expect(SWATCHES).toEqual(['#4E46C6', '#2E7042', '#A44E14', '#A03028', '#2A5DAE', '#79756A']);
  });
});
