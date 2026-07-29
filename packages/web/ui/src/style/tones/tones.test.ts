import { describe, expect, it } from 'vitest';
import { HUE_TONES, STEP, TONE_NAMES, toneClasses, TONES } from './tones';

const EMPHASES = ['subtle', 'solid', 'outline', 'text'] as const;

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

  it('resolves every tone x emphasis to non-empty literal classes', () => {
    for (const tone of TONE_NAMES) {
      for (const emphasis of EMPHASES) {
        const classes = toneClasses(tone, emphasis);
        expect(classes.length).toBeGreaterThan(0);
        expect(classes).not.toContain('${'); // literals only — Tailwind must be able to scan them
        expect(classes).not.toContain('undefined');
      }
    }
  });

  it('defaults to subtle emphasis', () => {
    expect(toneClasses('green')).toBe(toneClasses('green', 'subtle'));
  });

  it('maps hues onto the opt-* families', () => {
    expect(toneClasses('green', 'subtle')).toBe('bg-green-3 text-green-11');
    expect(toneClasses('green', 'solid')).toBe('bg-green-9 text-green-contrast');
    expect(toneClasses('green', 'outline')).toBe(
      'border-2 border-green-7 text-green-11',
    );
    expect(toneClasses('green', 'text')).toBe('text-green-11');
  });

  it('maps semantic aliases onto their declared families', () => {
    expect(toneClasses('primary', 'subtle')).toBe('bg-indigo-3 text-indigo-11');
    expect(toneClasses('primary', 'solid')).toBe('bg-indigo-9 text-indigo-contrast');
    expect(toneClasses('secondary', 'subtle')).toBe('bg-gray-3 text-gray-11');
    expect(toneClasses('secondary', 'solid')).toBe('bg-gray-9 text-gray-contrast');
    expect(toneClasses('danger', 'solid')).toBe('bg-red-9 text-red-contrast');
    expect(toneClasses('neutral', 'text')).toBe('text-gray-11');
  });

  // STEP is what components interpolate — `bg-${scale}-${STEP.solid}` — while
  // TONES is what `toneClasses()` returns. Both come from tones.tokens.json, so
  // re-anchoring a rung there has to move both together. If it ever moves only
  // one, a Pill and a Button asking for the same treatment would disagree, and
  // nothing else in the suite would notice.
  it('agrees with the finished class strings toneClasses() hands out', () => {
    expect(toneClasses('green', 'subtle')).toBe(
      `bg-green-${STEP.bgSubtle} text-green-${STEP.text}`,
    );
    expect(toneClasses('green', 'solid')).toBe(`bg-green-${STEP.solid} text-green-${STEP.contrast}`);
    expect(toneClasses('green', 'outline')).toBe(
      `border-2 border-green-${STEP.border} text-green-${STEP.text}`,
    );
    expect(toneClasses('green', 'text')).toBe(`text-green-${STEP.text}`);
  });

  it('orders the interaction rungs so hover and active always darken', () => {
    expect(STEP.bgSubtle).toBeLessThan(STEP.bgSubtleHover);
    expect(STEP.bgSubtleHover).toBeLessThan(STEP.bgSubtleActive);
    expect(STEP.border).toBeLessThan(STEP.borderHover);
    expect(STEP.solid).toBeLessThan(STEP.solidHover);
    expect(STEP.solidHover).toBeLessThan(STEP.solidActive);
    expect(STEP.text).toBeLessThan(STEP.textStrong);
  });

  it('every class in the map is one of the three known utility shapes', () => {
    // `border-2` used to be listed as a fourth alternative, but
    // `border-[a-z0-9-]+` already matches it (`2` is `[a-z0-9-]`) — a dead
    // branch that could never be reached.
    const CLASS_RE = /^(bg-[a-z0-9-]+|text-[a-z0-9-]+|border-[a-z0-9-]+)$/;
    for (const emphases of Object.values(TONES)) {
      for (const classes of Object.values(emphases)) {
        for (const cls of classes.split(' ')) {
          expect(cls).toMatch(CLASS_RE);
        }
      }
    }
  });
});
