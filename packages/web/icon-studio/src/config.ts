/** Sticks in paint order: `top` is frontmost and leads the loader. */
export const STICKS = ['top', 'mid', 'low'] as const;

type Triple = [string, string, string];

/** Which pose the loader sits on when nothing is running. */
export const REST_POSES = ['logo', 'fan'] as const;
export type RestPose = (typeof REST_POSES)[number];

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
