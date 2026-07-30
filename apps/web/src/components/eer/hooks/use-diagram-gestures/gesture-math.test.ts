import { describe, expect, it } from 'vitest';

import { buildModel, nestedRaw } from '../../test/models';
import { clamp, clampCardToBox, contentBoundsOf, cursorFor, edgeMaskFor, resizeBox } from './gesture-math';

describe('resizeBox', () => {
  // Ported from the old eer-diagram resize expectations.
  it('never cuts children off and respects min size', () => {
    const content = { minX: 100, minY: 100, maxX: 300, maxY: 200 };
    const out = resizeBox({ x: 80, y: 60, w: 400, h: 300 }, { l: false, r: true, t: false, b: false }, -500, 0, content, null);
    expect(out.x + out.w).toBeGreaterThanOrEqual(300 + 8); // content.maxX + IN_PAD
    const min = resizeBox({ x: 0, y: 0, w: 150, h: 90 }, { l: false, r: true, t: false, b: true }, -200, -200, null, null);
    expect(min.w).toBe(140);
    expect(min.h).toBe(80);
  });

  it('keeps a subgroup box inside its parent when resizing outward', () => {
    const parent = { id: 'p', label: 'P', x: 0, y: 0, w: 400, h: 400, parent: null, level: 0 };
    const out = resizeBox({ x: 50, y: 50, w: 100, h: 100 }, { l: false, r: true, t: false, b: true }, 1000, 1000, null, parent);
    expect(out.x + out.w).toBeLessThanOrEqual(parent.x + parent.w - 8); // parent right minus IN_PAD
    expect(out.y + out.h).toBeLessThanOrEqual(parent.y + parent.h - 8); // parent bottom minus IN_PAD
  });

  it('moves the grabbed left/top edge (min-size priority to that side)', () => {
    // dragging the left edge far right past min width pins x1 = x2 - 140.
    const out = resizeBox({ x: 0, y: 0, w: 150, h: 90 }, { l: true, r: false, t: true, b: false }, 500, 500, null, null);
    expect(out.w).toBe(140);
    expect(out.h).toBe(80);
    expect(out.x + out.w).toBe(150); // right edge (x2) stayed put
    expect(out.y + out.h).toBe(90); // bottom edge (y2) stayed put
  });
});

describe('edgeMaskFor', () => {
  it('returns null when the rect is 0x0 (jsdom guard)', () => {
    const el = document.createElement('div');
    document.body.appendChild(el); // getBoundingClientRect → 0x0 in jsdom
    expect(edgeMaskFor(el, { clientX: 0, clientY: 0 } as MouseEvent)).toBeNull();
    el.remove();
  });
});

describe('cursorFor', () => {
  it('maps corners and edges to the right resize cursor', () => {
    expect(cursorFor({ l: true, r: false, t: true, b: false })).toBe('nwse-resize');
    expect(cursorFor({ l: false, r: true, t: false, b: true })).toBe('nwse-resize');
    expect(cursorFor({ l: false, r: true, t: true, b: false })).toBe('nesw-resize');
    expect(cursorFor({ l: true, r: false, t: false, b: true })).toBe('nesw-resize');
    expect(cursorFor({ l: true, r: false, t: false, b: false })).toBe('ew-resize');
    expect(cursorFor({ l: false, r: false, t: true, b: false })).toBe('ns-resize');
  });
});

describe('clamp', () => {
  it('bounds a value to [lo, hi]', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });
});

describe('clampCardToBox', () => {
  it('keeps a card inside its box with left/top priority', () => {
    const e = { _w: 100, _h: 40 } as never;
    const b = { x: 0, y: 0, w: 200, h: 200 } as never;
    // far past the right/bottom → clamps to the max inset
    expect(clampCardToBox(1000, 1000, e, b)).toEqual({ x: 200 - 8 - 100, y: 200 - 8 - 40 });
    // far past the left/top → clamps to the min inset (IN_PAD / IN_LABEL)
    expect(clampCardToBox(-1000, -1000, e, b)).toEqual({ x: 8, y: 30 });
  });

  it('min-after-max lets left/top win in a tiny box', () => {
    const e = { _w: 300, _h: 300 } as never;
    const b = { x: 10, y: 10, w: 100, h: 100 } as never;
    // box smaller than the card: max pins to a negative inset, then min forces left/top.
    expect(clampCardToBox(50, 50, e, b)).toEqual({ x: 18, y: 40 });
  });
});

describe('contentBoundsOf', () => {
  it('unions member cards (and subgroup boxes for a zone)', () => {
    const model = buildModel(nestedRaw());
    const bounds = contentBoundsOf(model, 'z');
    expect(bounds).not.toBeNull();
    // the zone's content bound must contain its subgroup box `s`.
    const sub = model._groupBounds.find((b) => b.id === 's')!;
    expect(bounds!.minX).toBeLessThanOrEqual(sub.x);
    expect(bounds!.maxX).toBeGreaterThanOrEqual(sub.x + sub.w);
  });
});
