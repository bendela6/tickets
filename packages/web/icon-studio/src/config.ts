/** Sticks in paint order: `top` is frontmost and leads the loader. */
export const STICKS = ['top', 'mid', 'low'] as const;
export type Stick = (typeof STICKS)[number];

type Triple = [string, string, string];

export interface MarkConfig {
  /** Hex per stick, in `top, mid, low` order. */
  light: Triple;
  dark: Triple;
  /** Field behind the mark on the chip variants. */
  chip: string;
  /** Degrees per stick, in `top, mid, low` order. */
  angles: [number, number, number];
  /** Stroke width of the bare mark on the 48-unit grid. */
  bareWeight: number;
  /** Arm reach and stroke for the inset chip variants. */
  chipReach: number;
  chipWeight: number;
}

/** Reach of a bare stick: it spans the full diameter, 6..42 on a 48 grid. */
export const BARE_REACH = 18;

/**
 * Weight-to-reach ratio. Any inset variant must hold it or the mark reads
 * bolder than the favicon — the chip at reach 14 therefore uses stroke 4.6.
 */
export const RATIO = 1 / 3;

export const DEFAULT_CONFIG: MarkConfig = {
  light: ['#7167ff', '#00bb9a', '#ff298a'],
  dark: ['#6652ff', '#12b898', '#ff378c'],
  chip: '#1b1830',
  angles: [62, 27, 160],
  bareWeight: 6,
  chipReach: 14,
  chipWeight: 4.6,
};

export interface Palette {
  light: Triple;
  dark: Triple;
  chip: string;
}

export type PresetName = 'chosen' | 'lifted' | 'neon' | 'soft';

export const PRESETS: Record<PresetName, Palette> = {
  chosen: {
    light: ['#7167ff', '#00bb9a', '#ff298a'],
    dark: ['#6652ff', '#12b898', '#ff378c'],
    chip: '#1b1830',
  },
  // Identical to `chosen` except the dark violet is lifted, taking it from
  // 2.42:1 to 3.29:1 on a selected dark tab.
  lifted: {
    light: ['#7167ff', '#00bb9a', '#ff298a'],
    dark: ['#8071ff', '#12b898', '#ff378c'],
    chip: '#1b1830',
  },
  neon: {
    light: ['#7c6cff', '#12d6b8', '#ff4fa3'],
    dark: ['#9182ff', '#22cdb0', '#ff6fae'],
    chip: '#16131f',
  },
  soft: {
    light: ['#5a4ff3', '#0d8a74', '#d92b7a'],
    dark: ['#8a7bff', '#2ec5a8', '#f56aa5'],
    chip: '#1b1830',
  },
};
