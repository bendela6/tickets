/**
 * Grounds the mark is judged against. Not the app's own surfaces — a favicon
 * lives in browser chrome, so these are a white tab and a selected dark tab.
 */
export const GROUND = { light: '#ffffff', dark: '#35363a' } as const;

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

function channels(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
}

function sector(i: number, c: number, x: number): [number, number, number] {
  switch (i) {
    case 0: return [c, x, 0];
    case 1: return [x, c, 0];
    case 2: return [0, c, x];
    case 3: return [0, x, c];
    case 4: return [x, 0, c];
    default: return [c, 0, x];
  }
}

export function toHsl(hex: string): [number, number, number] {
  const [r, g, b] = channels(hex);
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  const l = (mx + mn) / 2;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}

export function toHex(h: number, s: number, l: number): string {
  const hue = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  const seg = sector(Math.floor(hue / 60) % 6, c, x);
  return '#' + seg.map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
}

/** A non-destructive shift applied over a base colour. */
export interface Adjust {
  /** Degrees added to the hue. */
  hue: number;
  /** Saturation multiplier. */
  sat: number;
  /** Lightness offset, added. */
  lit: number;
}

export const NEUTRAL: Adjust = { hue: 0, sat: 1, lit: 0 };

export function adjust(hex: string, a: Adjust): string {
  const [h, s, l] = toHsl(hex);
  return toHex(h + a.hue, clamp(s * a.sat, 0, 1), clamp(l + a.lit, 0.03, 0.97));
}

const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

export function luminance(hex: string): number {
  const [r, g, b] = channels(hex);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function contrast(a: string, b: string): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/**
 * `ok` is comfortable at 16px, `min` clears the 3:1 floor for a graphic, `bad`
 * is below it. A brand mark has no WCAG minimum — WCAG 1.4.11 exempts
 * logotypes — so treat `bad` as "hard to find", not as a violation.
 */
export type Verdict = 'ok' | 'min' | 'bad';

export function verdict(ratio: number): Verdict {
  if (ratio >= 4.5) return 'ok';
  if (ratio >= 3) return 'min';
  return 'bad';
}
