import type { MarkConfig } from '../config';
import { BARE_REACH } from '../config';

const CENTRE = 24;

/** Android crops a maskable icon to a circle; content must stay inside 80%. */
export const SAFE_ZONE_PCT = 80;

interface StickOpts {
  angles: [number, number, number];
  reach: number;
  weight: number;
  /** Literal stroke colour per stick, or omit and pass `classes` instead. */
  colours?: [string, string, string];
  /** Class per stick, for the favicon's media-query swap. */
  classes?: [string, string, string];
}

/**
 * Sticks in reverse index order — SVG paints in document order and has no
 * z-index, so appending low, mid, top puts `top` frontmost.
 */
function sticks({ angles, reach, weight, colours, classes }: StickOpts): string {
  let out = '';
  for (let i = 2; i >= 0; i--) {
    const paint = classes ? ` class="${classes[i]}"` : ` stroke="${colours![i]}"`;
    out +=
      `\n    <path d="M${CENTRE} ${CENTRE - reach}L${CENTRE} ${CENTRE + reach}"${paint}` +
      ` stroke-width="${weight}" stroke-linecap="round" fill="none"` +
      ` transform="rotate(${angles[i]} ${CENTRE} ${CENTRE})"/>`;
  }
  return out;
}

const open = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">';

/**
 * Theme-aware bare mark. `currentColor` is no use in a favicon — the file has
 * no inherited colour — so both triads are inlined and swapped by a media
 * query inside the SVG itself.
 */
export function svgFavicon(c: MarkConfig): string {
  const [l1, l2, l3] = c.light;
  const [d1, d2, d3] = c.dark;
  return `${open}
  <style>
    .s1{stroke:${l1}}.s2{stroke:${l2}}.s3{stroke:${l3}}
    @media (prefers-color-scheme:dark){.s1{stroke:${d1}}.s2{stroke:${d2}}.s3{stroke:${d3}}}
  </style>
  <g fill="none">${sticks({
    angles: c.angles,
    reach: BARE_REACH,
    weight: c.bareWeight,
    classes: ['s1', 's2', 's3'],
  })}
  </g>
</svg>
`;
}

/** Single-theme bare mark, for the rail, lockups and docs. */
export function svgBare(c: MarkConfig, mode: 'light' | 'dark'): string {
  return `${open}
  <g fill="none">${sticks({
    angles: c.angles,
    reach: BARE_REACH,
    weight: c.bareWeight,
    colours: c[mode],
  })}
  </g>
</svg>
`;
}

/** Safari's pinned tab needs one colour; the browser tints it itself. */
export function svgMono(c: MarkConfig): string {
  return `${open}
  <g fill="none">${sticks({
    angles: c.angles,
    reach: BARE_REACH,
    weight: c.bareWeight,
    colours: ['#000', '#000', '#000'],
  })}
  </g>
</svg>
`;
}

/**
 * Dark field with the mark on top. A coloured field cannot knock out three
 * colours, and a dark chip lets the mark sit at full strength on any home
 * screen wallpaper — so the field is dark in both themes.
 */
export function svgChip(c: MarkConfig, opts: { rounded?: boolean } = {}): string {
  const rx = opts.rounded === false ? 0 : 11;
  return `${open}
  <rect width="48" height="48" rx="${rx}" fill="${c.chip}"/>
  <g fill="none">${sticks({
    angles: c.angles,
    reach: c.chipReach,
    weight: c.chipWeight,
    colours: c.dark,
  })}
  </g>
</svg>
`;
}

/** How far the chip mark reaches from the centre, including the stroke cap. */
export function outerExtent(c: MarkConfig): number {
  return c.chipReach + c.chipWeight / 2;
}

/** That extent as a percentage of the tile's half-width. */
export function safeZonePct(c: MarkConfig): number {
  return (outerExtent(c) / CENTRE) * 100;
}
