import type { Bounds } from '../visible-bounds';

export interface ViewTransform {
  zoom: number;
  panX: number;
  panY: number;
}

const PAD = 56;

export function fitView(b: Bounds, vw: number, vh: number): ViewTransform {
  const bw = b.maxX - b.minX + PAD * 2;
  const bh = b.maxY - b.minY + PAD * 2;
  const zoom = Math.max(0.15, Math.min(vw / bw, vh / bh, 1.6));
  return {
    zoom,
    panX: (vw - bw * zoom) / 2 - (b.minX - PAD) * zoom,
    panY: (vh - bh * zoom) / 2 - (b.minY - PAD) * zoom,
  };
}

export function centerOnPoint(
  cx: number,
  cy: number,
  vw: number,
  vh: number,
  zoom: number
): { panX: number; panY: number } {
  return { panX: vw / 2 - cx * zoom, panY: vh / 2 - cy * zoom };
}
