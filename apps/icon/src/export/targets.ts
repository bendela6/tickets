export type TargetId =
  | 'fav'
  | 'pwa'
  | 'ios'
  | 'and'
  | 'mac'
  | 'win'
  | 'asvg'
  | 'lottie'
  | 'afav';

export interface Target {
  id: TargetId;
  name: string;
  /** The sizes column, as the dialog prints it. */
  sizes: string;
  /** The filename column: what this target writes. */
  writes: string;
  /** How many files it contributes to the summary. */
  files: number;
  /** Animated targets need a sustained state; without one they stay unavailable. */
  animated?: true;
}

/**
 * The nine targets, transcribed from the design.
 *
 * `files` is what the running summary adds up, so it has to be the number of
 * files that actually land on disk — `run.test.ts` asserts that against what
 * `buildFiles` produces rather than trusting the number here.
 *
 * That makes three of these differ from the design's own column, which counted
 * *images* rather than files: macOS and Windows each produce one container,
 * not ten and five loose PNGs, and iOS produces thirteen images plus the
 * `Contents.json` without which Xcode will not read the set. A summary that
 * promised "10 files" and wrote one would be a worse kind of wrong than a
 * number that disagrees with a mock-up.
 */
export const TARGETS: readonly Target[] = [
  { id: 'fav', name: 'Browser favicon', sizes: '16 · 32 · 48', writes: 'favicon.ico +3', files: 4 },
  { id: 'pwa', name: 'PWA', sizes: '192 · 512', writes: 'manifest +2', files: 3 },
  { id: 'ios', name: 'iOS', sizes: '20 → 1024', writes: 'appiconset', files: 14 },
  { id: 'and', name: 'Android', sizes: '48 → 512', writes: 'mipmap ×5', files: 5 },
  { id: 'mac', name: 'macOS', sizes: '16 → 1024', writes: 'icon.icns', files: 1 },
  { id: 'win', name: 'Windows', sizes: '16 → 256', writes: 'app.ico', files: 1 },
  { id: 'asvg', name: 'Animated SVG', sizes: 'vector', writes: 'icon.svg', files: 1, animated: true },
  {
    id: 'lottie',
    name: 'Lottie',
    sizes: 'vector · json',
    writes: 'icon.json',
    files: 1,
    animated: true,
  },
  {
    id: 'afav',
    name: 'Animated favicon',
    sizes: '32 · canvas',
    writes: 'favicon.js +1',
    files: 2,
    animated: true,
  },
];

/** The raster sizes each target needs, so nothing is rendered that no file uses. */
export const TARGET_SIZES: Partial<Record<TargetId, readonly number[]>> = {
  fav: [16, 32, 48],
  pwa: [192, 512],
  ios: [20, 29, 40, 58, 60, 76, 80, 87, 120, 152, 167, 180, 1024],
  and: [48, 72, 96, 144, 192, 512],
  mac: [16, 32, 64, 128, 256, 512, 1024],
  win: [16, 24, 32, 48, 256],
  // The animated favicon ships a still fallback, so it needs a raster of its
  // own rather than borrowing one another target happened to request.
  afav: [32],
};

/** Android's density buckets, which is what the mipmap folders are named for. */
export const ANDROID_BUCKETS: readonly { folder: string; size: number }[] = [
  { folder: 'mipmap-mdpi', size: 48 },
  { folder: 'mipmap-hdpi', size: 72 },
  { folder: 'mipmap-xhdpi', size: 96 },
  { folder: 'mipmap-xxhdpi', size: 144 },
  { folder: 'mipmap-xxxhdpi', size: 192 },
];

export const targetById = (id: TargetId): Target | undefined =>
  TARGETS.find((target) => target.id === id);
