import { describe, expect, it } from 'vitest';
import { emptyDocument, newObject } from '../doc/defaults';
import { arcPath } from '../doc/geometry';
import type { IconDoc } from '../doc/types';
import { isPng, readIcns, readIco } from './containers';
import { buildFiles, runExport, type Rasteriser } from './run';
import { TARGETS, type TargetId } from './targets';
import { readZip } from './zip';

/** The 512-square board most of these fixtures assume. */
const BOARD = { width: 512, height: 512 };

/** A stand-in rasteriser: a PNG signature plus the size, so payloads differ. */
const stubRasterise: Rasteriser = async (_svg, sizes) =>
  sizes.map((size) => {
    const bytes = new Uint8Array(12);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    new DataView(bytes.buffer).setUint32(8, size, false);
    return { size, bytes };
  });

const sizeOf = (png: Uint8Array) => new DataView(png.buffer, png.byteOffset).getUint32(8, false);

function docWith(): IconDoc {
  return {
    ...emptyDocument('wallet.icon'),
    objects: [newObject('rect', 1, BOARD), newObject('polygon', 2, BOARD)],
  };
}

const build = (targets: TargetId[], doc = docWith()) =>
  buildFiles({ doc, ground: 'light', targets }, stubRasterise);

describe('what each target writes', () => {
  it('the favicon target writes an .ico carrying its three sizes, plus loose PNGs', async () => {
    const files = await build(['fav']);
    expect(files.map((f) => f.path)).toEqual([
      'favicon.ico',
      'favicon-16.png',
      'favicon-32.png',
      'favicon-48.png',
    ]);
    const entries = readIco(files[0]!.bytes);
    expect(entries.map((e) => e.width)).toEqual([16, 32, 48]);
    // Each slot holds the PNG for its own size, not whichever came first.
    expect(entries.map((e) => sizeOf(e.bytes))).toEqual([16, 32, 48]);
  });

  it('the PWA target writes a manifest that names the files beside it', async () => {
    const files = await build(['pwa']);
    const manifest = files.find((f) => f.path === 'pwa/site.webmanifest');
    const parsed = JSON.parse(new TextDecoder().decode(manifest!.bytes));
    expect(parsed.icons.map((icon: { src: string }) => icon.src)).toEqual([
      'icon-192.png',
      'icon-512.png',
    ]);
    for (const icon of parsed.icons) {
      expect(files.some((f) => f.path === `pwa/${icon.src}`)).toBe(true);
    }
    expect(parsed.name).toBe('wallet');
  });

  it('the iOS target writes a Contents.json whose filenames all exist', async () => {
    const files = await build(['ios']);
    const contents = JSON.parse(
      new TextDecoder().decode(files.find((f) => f.path.endsWith('Contents.json'))!.bytes),
    );
    expect(contents.images).toHaveLength(13);
    for (const image of contents.images) {
      expect(files.some((f) => f.path === `ios/AppIcon.appiconset/${image.filename}`)).toBe(true);
      expect(image.idiom).toBeTruthy();
      expect(image.scale).toBeTruthy();
    }
  });

  it('the Android target writes one launcher per density bucket, each at its own size', async () => {
    const files = await build(['and']);
    expect(files.map((f) => f.path)).toEqual([
      'android/mipmap-mdpi/ic_launcher.png',
      'android/mipmap-hdpi/ic_launcher.png',
      'android/mipmap-xhdpi/ic_launcher.png',
      'android/mipmap-xxhdpi/ic_launcher.png',
      'android/mipmap-xxxhdpi/ic_launcher.png',
    ]);
    expect(files.map((f) => sizeOf(f.bytes))).toEqual([48, 72, 96, 144, 192]);
  });

  it('the macOS target writes one .icns carrying every size it supports', async () => {
    const files = await build(['mac']);
    const chunks = readIcns(files[0]!.bytes);
    expect(chunks.map((c) => c.type)).toEqual([
      'icp4',
      'icp5',
      'icp6',
      'ic07',
      'ic08',
      'ic09',
      'ic10',
    ]);
    expect(chunks.every((c) => isPng(c.bytes))).toBe(true);
  });

  it('the Windows target writes one .ico with five sizes', async () => {
    const files = await build(['win']);
    expect(files.map((f) => f.path)).toEqual(['app.ico']);
    expect(readIco(files[0]!.bytes).map((e) => e.width)).toEqual([16, 24, 32, 48, 256]);
  });
});

describe('the summary', () => {
  it('every target’s declared file count is what it actually writes', async () => {
    const doc = docWith();
    for (const target of TARGETS) {
      const files = await buildFiles({ doc, ground: 'light', targets: [target.id] }, stubRasterise);
      expect({ id: target.id, files: files.length }).toEqual({
        id: target.id,
        files: target.files,
      });
    }
  });

  it('offers the six platforms an icon is shipped to, and nothing else', () => {
    expect(TARGETS.map((target) => target.id)).toEqual([
      'fav',
      'pwa',
      'ios',
      'and',
      'mac',
      'win',
    ]);
  });
});

describe('runExport', () => {
  it('packages every file into one readable archive', async () => {
    const archive = await runExport(
      { doc: docWith(), ground: 'light', targets: ['fav', 'mac'] },
      stubRasterise,
    );
    const entries = readZip(archive);
    expect(entries.map((e) => e.path)).toEqual([
      'favicon.ico',
      'favicon-16.png',
      'favicon-32.png',
      'favicon-48.png',
      'AppIcon.icns',
    ]);
    expect(readIco(entries[0]!.bytes)).toHaveLength(3);
  });

  it('renders each size once even when two targets both want it', async () => {
    let asked: readonly number[] = [];
    const counting: Rasteriser = async (svg, sizes) => {
      asked = sizes;
      return stubRasterise(svg, sizes);
    };
    // fav wants 16/32/48 and win wants 16/24/32/48/256 — 16, 32 and 48 overlap.
    await buildFiles({ doc: docWith(), ground: 'light', targets: ['fav', 'win'] }, counting);
    expect(asked).toEqual([16, 24, 32, 48, 256]);
  });

  it('rasterises the one picture the document holds', async () => {
    const doc: IconDoc = {
      ...docWith(),
      objects: [{ ...newObject('rect', 1, BOARD), rotation: 110 }],
    };
    let seen = '';
    const capture: Rasteriser = async (svg, sizes) => {
      seen = svg;
      return stubRasterise(svg, sizes);
    };
    await buildFiles({ doc, ground: 'light', targets: ['fav'] }, capture);
    expect(seen).toContain('rotate(110');
  });

  it('paints the ground it is asked for', async () => {
    let seen = '';
    const capture: Rasteriser = async (svg, sizes) => {
      seen = svg;
      return stubRasterise(svg, sizes);
    };
    await buildFiles({ doc: docWith(), ground: 'dark', targets: ['fav'] }, capture);
    expect(seen).toContain('#14130F');
  });

  it('writes nothing when nothing is selected', async () => {
    expect(
      readZip(await runExport({ doc: docWith(), ground: 'light', targets: [] }, stubRasterise)),
    ).toEqual([]);
  });
});
