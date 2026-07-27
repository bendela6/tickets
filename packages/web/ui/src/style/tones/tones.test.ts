import { describe, expect, it } from 'vitest';
import { HUE_TONES, TONE_NAMES, toneClasses, TONES } from './tones';

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
    expect(toneClasses('green', 'subtle')).toBe('bg-opt-green-subtle text-opt-green');
    expect(toneClasses('green', 'solid')).toBe('bg-opt-green text-on-opt-green');
    expect(toneClasses('green', 'outline')).toBe(
      'border-(length:--border-hair) border-opt-green text-opt-green',
    );
    expect(toneClasses('green', 'text')).toBe('text-opt-green');
  });

  it('maps semantic aliases onto their declared families', () => {
    expect(toneClasses('primary', 'subtle')).toBe('bg-accent-subtle text-accent');
    expect(toneClasses('primary', 'solid')).toBe('bg-accent text-on-accent');
    expect(toneClasses('secondary', 'subtle')).toBe('bg-inset text-ink-2');
    expect(toneClasses('secondary', 'solid')).toBe('bg-ink-2 text-app');
    expect(toneClasses('danger', 'solid')).toBe('bg-danger text-on-danger');
    expect(toneClasses('neutral', 'text')).toBe('text-ink-3');
  });

  it('every class in the map is one of the four known utility shapes', () => {
    const CLASS_RE =
      /^(bg-[a-z0-9-]+|text-[a-z0-9-]+|border-[a-z0-9-]+|border-\(length:--border-hair\))$/;
    for (const emphases of Object.values(TONES)) {
      for (const classes of Object.values(emphases)) {
        for (const cls of classes.split(' ')) {
          expect(cls).toMatch(CLASS_RE);
        }
      }
    }
  });
});
