import { describe, it, expect } from 'vitest';
import { fitView, centerOnPoint } from './fit-view';

describe('fitView', () => {
  it('centers content and clamps zoom to [0.15, 1.6]', () => {
    const v = fitView({ minX: 0, minY: 0, maxX: 100, maxY: 100 }, 1000, 800);
    expect(v.zoom).toBe(1.6); // small content clamps high
    // content center maps to viewport center:
    expect(v.panX + 50 * v.zoom).toBeCloseTo(500, 5);
    expect(v.panY + 50 * v.zoom).toBeCloseTo(400, 5);
    const tiny = fitView({ minX: 0, minY: 0, maxX: 100000, maxY: 100 }, 1000, 800);
    expect(tiny.zoom).toBe(0.15); // huge content clamps low
  });
});

describe('centerOnPoint', () => {
  it('centerOnPoint puts the point mid-viewport', () => {
    const p = centerOnPoint(200, 100, 1000, 800, 2);
    expect(p.panX).toBe(1000 / 2 - 200 * 2);
    expect(p.panY).toBe(800 / 2 - 100 * 2);
  });
});
