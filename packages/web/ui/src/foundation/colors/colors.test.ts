import { describe, it, expect } from 'vitest';
import {
  advisoryPairings,
  STEPS,
  checkPairings,
  colorOf,
  surfaceOf,
  contrastRatio,
  failingPairings,
  luminance,
} from './colors';
import { HUES } from '../../style/generated';

describe('contrastRatio', () => {
  it('matches the WCAG extremes', () => {
    // Black on white is the definitional maximum; a colour on itself is 1.
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#7f7f7f', '#7f7f7f')).toBeCloseTo(1, 5);
  });

  it('is symmetric — argument order cannot change the verdict', () => {
    expect(contrastRatio('#25231d', '#f7f6f2')).toBeCloseTo(
      contrastRatio('#f7f6f2', '#25231d'),
      10,
    );
  });

  it('matches a known third-party value', () => {
    // #767676 on white is the canonical "exactly AA for body text" grey.
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 1);
  });

  it('applies the sRGB transfer curve, not a linear one', () => {
    // A naive (channel/255) luminance would put mid-grey at 0.5; the real
    // curve puts it near 0.216. This is what makes the ratios trustworthy.
    expect(luminance('#808080')).toBeCloseTo(0.2159, 3);
  });
});

describe('colorOf', () => {
  it('reads every step of every scale, in both themes', () => {
    for (const theme of ['light', 'dark'] as const) {
      for (const scale of HUES) {
        for (const step of STEPS) {
          expect(colorOf(theme, scale, step)).toMatch(/^#[0-9a-f]{6}$/);
        }
        expect(colorOf(theme, scale, 'contrast')).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  it('throws on an unknown token rather than returning undefined', () => {
    expect(() => colorOf('light', 'chartreuse', 9)).toThrow(/unknown color token/);
  });
});

describe('checkPairings', () => {
  it('covers every emphasis, scale and theme, plus the field border', () => {
    // (4 per-scale checks x 11 scales + 1 field border) x 2 themes.
    expect(checkPairings()).toHaveLength((4 * HUES.length + 1) * 2);
  });

  it('holds borders to 3:1 and text to 4.5:1', () => {
    const all = checkPairings();
    expect(all.filter((p) => p.what === 'border').every((p) => p.min === 3)).toBe(true);
    expect(all.filter((p) => p.what === 'text').every((p) => p.min === 4.5)).toBe(true);
  });

  it('enforces the field border but only advises on decorative ones', () => {
    const all = checkPairings();
    const sev = (emphasis: string) =>
      [...new Set(all.filter((p) => p.emphasis === emphasis).map((p) => p.severity))];
    expect(sev('field-border')).toEqual(['required']);
    expect(sev('outline-border')).toEqual(['advisory']);
  });

  it('judges the field border against the worse of the two surfaces it divides', () => {
    // A border has to be visible against both the page and the field's own
    // fill, so the reported ratio is the lower of the two — not whichever
    // side happens to be checked first.
    for (const theme of ['light', 'dark'] as const) {
      const p = checkPairings().find((x) => x.emphasis === 'field-border' && x.theme === theme);
      const border = colorOf(theme, 'gray', 7);
      const vsPage = contrastRatio(border, colorOf(theme, 'gray', 1));
      const vsFill = contrastRatio(border, surfaceOf(theme, 'raised'));
      expect(p?.ratio).toBeCloseTo(Math.min(vsPage, vsFill), 2);
      expect(p?.bgLabel).toBe(vsPage <= vsFill ? 'page' : 'field fill');
      // The two sides genuinely differ, so taking the minimum is doing work.
      expect(vsPage).not.toBeCloseTo(vsFill, 2);
    }
  });

  it('sets `passes` from the ratio and its own minimum', () => {
    for (const p of checkPairings()) {
      expect(p.passes).toBe(p.ratio >= p.min);
    }
  });

  it('reports only required failures, and separates advisory ones', () => {
    // The field border is the one outstanding defect: at 1.59/1.72 against
    // the surfaces it divides, nothing but that line says a text field is
    // there. If a ramp change fixes or worsens it, this test says so.
    const failing = failingPairings();
    const ids = failing.map((f) => `${f.emphasis}/${f.scale}/${f.theme}`).sort();
    expect(ids).toEqual(['field-border/gray/dark', 'field-border/gray/light']);

    // Decorative outline borders are below 3:1 on every scale, but they are
    // reported rather than enforced — a chip is identified by its label.
    expect(advisoryPairings()).toHaveLength(HUES.length * 2);
  });

  it('keeps grey solid readable, which is why gray-9 was re-anchored', () => {
    // gray-9 used to be #918d80, a light mid-tone where NEITHER foreground
    // passed: white scored 3.32 and dark ink 4.35 — the dead zone. Moving the
    // anchor to #777368 puts white at 4.73, and WCAG and APCA finally agree
    // with each other and with the eye. Every scale now takes white.
    for (const theme of ['light', 'dark'] as const) {
      const solid = checkPairings().find(
        (p) => p.emphasis === 'solid' && p.scale === 'gray' && p.theme === theme,
      );
      expect(solid?.passes).toBe(true);
      expect(solid?.ratio).toBeGreaterThanOrEqual(4.5);
    }
    expect(colorOf('light', 'gray', 9)).toBe('#777368');
    expect(colorOf('light', 'gray', 'contrast')).toBe('#ffffff');
    expect(colorOf('dark', 'gray', 'contrast')).toBe('#ffffff');
  });

  it('keeps the gray ramp monotonic through the re-anchored steps', () => {
    // 11 and 12 are the ink steps and map exactly onto today's --color-ink-2
    // and --color-ink, so the re-anchor had to move 9 and 10 without crossing
    // them. If a future anchor change breaks the ordering, hover stops reading
    // as a darker state.
    const lum = [8, 9, 10, 11, 12].map((s) => luminance(colorOf('light', 'gray', s as never)));
    for (let i = 1; i < lum.length; i += 1) expect(lum[i]!).toBeLessThan(lum[i - 1]!);
  });
});
