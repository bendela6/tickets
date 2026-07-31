import type { Ground, IconDoc, Sustain } from '../doc/types';
import { renderSvg } from '../render/svg';
import { sustainedState } from '../transport/clock';
import { animatedFavicon, animatedSvg, lottie } from './animated';
import { createIcns, createIco, type SizedPng } from './containers';
import { rasteriseAll } from './raster';
import { ANDROID_BUCKETS, TARGET_SIZES, type TargetId } from './targets';
import { createZip, type ZipEntry } from './zip';

export interface ExportRequest {
  doc: IconDoc;
  ground: Ground;
  /** Which state the static targets capture. */
  stateId: string;
  targets: TargetId[];
}

/** Swappable so tests do not need a real canvas. */
export type Rasteriser = (svg: string, sizes: readonly number[]) => Promise<SizedPng[]>;

const encode = (text: string) => new TextEncoder().encode(text);

/**
 * Every file the chosen targets produce.
 *
 * One SVG is rendered and every raster target scales it, so a shape cannot
 * look different at 16px than it does at 1024px for any reason other than the
 * rasteriser.
 */
export async function buildFiles(
  request: ExportRequest,
  rasterise: Rasteriser = rasteriseAll,
): Promise<ZipEntry[]> {
  const { doc, ground, stateId, targets } = request;
  const svg = renderSvg(doc, { ground, stateId });
  const files: ZipEntry[] = [];

  // Render each size once even when several targets want it.
  const wanted = new Set<number>();
  for (const id of targets) for (const size of TARGET_SIZES[id] ?? []) wanted.add(size);
  const rendered = await rasterise(svg, [...wanted].sort((a, b) => a - b));
  const pngAt = (size: number): Uint8Array => {
    const found = rendered.find((image) => image.size === size);
    if (!found) throw new Error(`no raster was produced at ${size}px`);
    return found.bytes;
  };
  const sized = (sizes: readonly number[]): SizedPng[] =>
    sizes.map((size) => ({ size, bytes: pngAt(size) }));

  if (targets.includes('fav')) {
    files.push({ path: 'favicon.ico', bytes: createIco(sized(TARGET_SIZES.fav ?? [])) });
    for (const size of TARGET_SIZES.fav ?? []) {
      files.push({ path: `favicon-${size}.png`, bytes: pngAt(size) });
    }
  }

  if (targets.includes('pwa')) {
    for (const size of TARGET_SIZES.pwa ?? []) {
      files.push({ path: `pwa/icon-${size}.png`, bytes: pngAt(size) });
    }
    files.push({ path: 'pwa/site.webmanifest', bytes: encode(webmanifest(doc, ground)) });
  }

  if (targets.includes('ios')) {
    const sizes = TARGET_SIZES.ios ?? [];
    for (const size of sizes) {
      files.push({ path: `ios/AppIcon.appiconset/icon-${size}.png`, bytes: pngAt(size) });
    }
    files.push({
      path: 'ios/AppIcon.appiconset/Contents.json',
      bytes: encode(appiconsetContents(sizes)),
    });
  }

  if (targets.includes('and')) {
    for (const bucket of ANDROID_BUCKETS) {
      files.push({
        path: `android/${bucket.folder}/ic_launcher.png`,
        bytes: pngAt(bucket.size),
      });
    }
  }

  if (targets.includes('mac')) {
    files.push({ path: 'AppIcon.icns', bytes: createIcns(sized(TARGET_SIZES.mac ?? [])) });
  }

  if (targets.includes('win')) {
    files.push({ path: 'app.ico', bytes: createIco(sized(TARGET_SIZES.win ?? [])) });
  }

  const sustained = sustainedState(doc);
  if (sustained?.sustain) {
    const source = {
      doc,
      ground,
      stateId: sustained.id,
      sustain: sustained.sustain as Exclude<Sustain, null>,
    };
    if (targets.includes('asvg')) {
      files.push({ path: 'icon.svg', bytes: encode(animatedSvg(source)) });
    }
    if (targets.includes('lottie')) {
      files.push({ path: 'icon.json', bytes: encode(JSON.stringify(lottie(source), null, 2)) });
    }
    if (targets.includes('afav')) {
      files.push({ path: 'favicon.js', bytes: encode(animatedFavicon(source)) });
      files.push({ path: 'favicon-32.png', bytes: pngAt(32) });
    }
  }

  return files;
}

/** Everything, as one archive. */
export async function runExport(
  request: ExportRequest,
  rasterise: Rasteriser = rasteriseAll,
): Promise<Uint8Array> {
  return createZip(await buildFiles(request, rasterise));
}

function webmanifest(doc: IconDoc, ground: Ground): string {
  return JSON.stringify(
    {
      name: doc.name.replace(/\.icon$/, ''),
      short_name: doc.name.replace(/\.icon$/, ''),
      icons: (TARGET_SIZES.pwa ?? []).map((size) => ({
        src: `icon-${size}.png`,
        sizes: `${size}x${size}`,
        type: 'image/png',
        // `any maskable` claims the icon is safe inside the 80% circle. The
        // dialog warns when it is not, but the claim belongs to whoever ships
        // the manifest, so it is written and flagged rather than silently
        // downgraded.
        purpose: 'any maskable',
      })),
      background_color: doc.background[ground],
      theme_color: doc.background[ground],
      display: 'standalone',
    },
    null,
    2,
  );
}

/** Which iOS slot each size fills, so Xcode reads the set rather than rejecting it. */
const IOS_SLOTS: Record<number, { idiom: string; size: string; scale: string }> = {
  20: { idiom: 'iphone', size: '20x20', scale: '1x' },
  29: { idiom: 'iphone', size: '29x29', scale: '1x' },
  40: { idiom: 'iphone', size: '20x20', scale: '2x' },
  58: { idiom: 'iphone', size: '29x29', scale: '2x' },
  60: { idiom: 'iphone', size: '20x20', scale: '3x' },
  76: { idiom: 'ipad', size: '76x76', scale: '1x' },
  80: { idiom: 'iphone', size: '40x40', scale: '2x' },
  87: { idiom: 'iphone', size: '29x29', scale: '3x' },
  120: { idiom: 'iphone', size: '60x60', scale: '2x' },
  152: { idiom: 'ipad', size: '76x76', scale: '2x' },
  167: { idiom: 'ipad', size: '83.5x83.5', scale: '2x' },
  180: { idiom: 'iphone', size: '60x60', scale: '3x' },
  1024: { idiom: 'ios-marketing', size: '1024x1024', scale: '1x' },
};

function appiconsetContents(sizes: readonly number[]): string {
  return JSON.stringify(
    {
      images: sizes
        .map((size) => {
          const slot = IOS_SLOTS[size];
          return slot ? { ...slot, filename: `icon-${size}.png` } : null;
        })
        .filter((entry) => entry !== null),
      info: { version: 1, author: 'icon' },
    },
    null,
    2,
  );
}
