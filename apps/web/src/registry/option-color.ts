import type { HueTone } from '@tickets/ui/tones';
import type { StatusKind } from '../api/types';

export type OptionColor = HueTone;

// Option/status configs store free-form hex colors; the Instrument palette is
// eleven named colors. Map by hue (circular distance), falling back to gray
// for unsaturated or unparseable values, so any stored hex lands on the
// nearest palette chip.
const HUE_ANCHORS: { color: OptionColor; hue: number }[] = [
  { color: 'red', hue: 0 },
  { color: 'orange', hue: 28 },
  { color: 'yellow', hue: 48 },
  { color: 'green', hue: 130 },
  { color: 'teal', hue: 168 },
  { color: 'cyan', hue: 194 },
  { color: 'blue', hue: 220 },
  { color: 'indigo', hue: 250 },
  { color: 'purple', hue: 282 },
  { color: 'pink', hue: 330 },
  { color: 'red', hue: 360 }, // wrap-around anchor
];

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const match = hex.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!match?.[1]) {
    return null;
  }
  const value = parseInt(match[1], 16);
  return { r: (value >> 16) & 0xff, g: (value >> 8) & 0xff, b: value & 0xff };
}

export function hexToOptionColor(hex: string | undefined | null): OptionColor {
  const rgb = hex ? parseHex(hex) : null;
  if (!rgb) {
    return 'gray';
  }
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  if (saturation < 0.14 || delta === 0) {
    return 'gray';
  }
  let hue: number;
  if (max === r) {
    hue = 60 * (((g - b) / delta) % 6);
  } else if (max === g) {
    hue = 60 * ((b - r) / delta + 2);
  } else {
    hue = 60 * ((r - g) / delta + 4);
  }
  hue = (hue + 360) % 360;
  let best: OptionColor = 'gray';
  let bestDistance = Infinity;
  for (const anchor of HUE_ANCHORS) {
    const distance = Math.abs(hue - anchor.hue);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = anchor.color;
    }
  }
  return best;
}

// Lifecycle kind -> named palette color. This is the workflow field's swatch
// source wherever a picker needs an OptionColor (e.g. FieldWidget's combobox
// chips); domain/status.ts's statusPill keys off `kind` directly via its own
// tone map, so it doesn't go through this mapping. Chosen from the 11 names
// actually declared above (no slate/amber/rose in this palette): todo/dropped
// are both neutral (gray) — dropped is further distinguished by the pill's
// strikethrough — active is blue, blocked is orange (nearest hue to the
// retired blocked-status color token, #c25425 — now opt-orange), done is green.
export function kindColor(kind: StatusKind | null): OptionColor {
  switch (kind) {
    case 'todo':
      return 'gray';
    case 'active':
      return 'blue';
    case 'blocked':
      return 'orange';
    case 'done':
      return 'green';
    case 'dropped':
      return 'gray';
    default:
      return 'gray';
  }
}
