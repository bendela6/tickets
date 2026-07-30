import { describe, expect, it } from 'vitest';
import { HUE_TONES, ROLE_TONES, TONE_NAMES, TONE_SCALE } from './tones';

// What survives here is the VOCABULARY. There used to be tests for
// `toneClasses()` (finished class strings per tone x emphasis), for the `STEP`
// rung table, and for the ordering of the interaction rungs. All three are gone
// with the tables they described — a component spells its own rung now, so
// nothing central knows that a subtle fill is 3 or that hover darkens.
describe('tone system', () => {
  it('has 6 semantic + 11 hue tones, hues last', () => {
    expect(TONE_NAMES).toEqual([
      'primary', 'secondary', 'success', 'warning', 'danger', 'neutral',
      'red', 'orange', 'yellow', 'green', 'teal', 'cyan', 'blue', 'indigo', 'purple', 'pink', 'gray',
    ]);
    expect(HUE_TONES).toEqual([
      'red', 'orange', 'yellow', 'green', 'teal', 'cyan', 'blue', 'indigo', 'purple', 'pink', 'gray',
    ]);
  });

  it('splits the names in two with nothing lost or counted twice', () => {
    expect([...ROLE_TONES, ...HUE_TONES]).toEqual([...TONE_NAMES]);
  });

  it('resolves every role onto a real scale', () => {
    // The role is the only indirection left: `danger` names a JOB and this is
    // what says which ramp currently does it. A role pointing at something
    // outside HUE_TONES would build `bg-crimson-9` — a class with no colour.
    expect(TONE_SCALE.primary).toBe('indigo');
    expect(TONE_SCALE.secondary).toBe('gray');
    expect(TONE_SCALE.success).toBe('green');
    expect(TONE_SCALE.warning).toBe('orange');
    expect(TONE_SCALE.danger).toBe('red');
    expect(TONE_SCALE.neutral).toBe('gray');
    for (const tone of TONE_NAMES) {
      expect(HUE_TONES).toContain(TONE_SCALE[tone]);
    }
  });

  it('maps every hue onto itself', () => {
    // A hue IS the scale, so the mapping has to be the identity there — a hue
    // that redirected would make `tone="red"` paint something other than red.
    for (const hue of HUE_TONES) {
      expect(TONE_SCALE[hue]).toBe(hue);
    }
  });
});
