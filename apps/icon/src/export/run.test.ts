import { describe, expect, it } from 'vitest';
import { emptyDocument, newObject } from '../doc/defaults';
import type { IconDoc } from '../doc/types';
import { isPng, readIcns, readIco } from './containers';
import { buildFiles, runExport, type Rasteriser } from './run';
import { TARGETS, type TargetId } from './targets';
import { readZip } from './zip';

/** A stand-in rasteriser: a PNG signature plus the size, so payloads differ. */
const stubRasterise: Rasteriser = async (_svg, sizes) =>
  sizes.map((size) => {
    const bytes = new Uint8Array(12);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    new DataView(bytes.buffer).setUint32(8, size, false);
    return { size, bytes };
  });

const sizeOf = (png: Uint8Array) => new DataView(png.buffer, png.byteOffset).getUint32(8, false);

function docWith(sustained = false): IconDoc {
  const base = emptyDocument('wallet.icon');
  return {
    ...base,
    objects: [newObject('rect', 1, 512), newObject('polygon', 2, 512)],
    states: [
      { id: 's0', name: 'idle', sustain: null },
      { id: 's1', name: 'loading', sustain: sustained ? 'turning' : null },
    ],
  };
}

const build = (targets: TargetId[], doc = docWith()) =>
  buildFiles({ doc, ground: 'light', stateId: 's0', targets }, stubRasterise);

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

describe('animated targets', () => {
  it('produce nothing at all when no state is sustained', async () => {
    expect(await build(['asvg', 'lottie', 'afav'], docWith(false))).toEqual([]);
  });

  it('the animated SVG animates and loops indefinitely', async () => {
    const files = await build(['asvg'], docWith(true));
    const svg = new TextDecoder().decode(files[0]!.bytes);
    expect(svg).toContain('repeatCount="indefinite"');
    expect(svg).toMatch(/<animate(Transform)?\b/);
  });

  it('the Lottie document is well-formed and matches the artboard', async () => {
    const files = await build(['lottie'], docWith(true));
    const parsed = JSON.parse(new TextDecoder().decode(files[0]!.bytes));
    expect(parsed.w).toBe(512);
    expect(parsed.h).toBe(512);
    expect(parsed.fr).toBeGreaterThan(0);
    expect(parsed.op).toBeGreaterThan(parsed.ip);
    expect(parsed.layers).toHaveLength(2);
    for (const layer of parsed.layers) {
      expect(layer.ty).toBe(4);
      expect(layer.shapes[0].ty).toBe('gr');
    }
  });

  it('the Lottie document gives every shape kind a real geometry', async () => {
    const doc: IconDoc = {
      ...docWith(true),
      objects: [
        newObject('rect', 1, 512),
        newObject('ellipse', 2, 512),
        newObject('line', 3, 512),
        newObject('polygon', 4, 512),
      ],
    };
    const files = await build(['lottie'], doc);
    const parsed = JSON.parse(new TextDecoder().decode(files[0]!.bytes));
    const kinds = parsed.layers.map((layer: { shapes: { it: { ty: string }[] }[] }) => layer.shapes[0]!.it[0]!.ty);
    // Reversed, because the document is front-to-back and painting is not.
    expect(kinds).toEqual(['sr', 'sh', 'el', 'rc']);
  });

  it('the animated favicon ships a script and its still fallback', async () => {
    const files = await build(['afav'], docWith(true));
    expect(files.map((f) => f.path)).toEqual(['favicon.js', 'favicon-32.png']);
    const script = new TextDecoder().decode(files[0]!.bytes);
    expect(script).toContain('prefers-reduced-motion');
    expect(script).toContain('visibilitychange');
  });
});

describe('the summary', () => {
  it('every target’s declared file count is what it actually writes', async () => {
    const doc = docWith(true);
    for (const target of TARGETS) {
      const files = await buildFiles(
        { doc, ground: 'light', stateId: 's0', targets: [target.id] },
        stubRasterise,
      );
      expect({ id: target.id, files: files.length }).toEqual({
        id: target.id,
        files: target.files,
      });
    }
  });
});

describe('runExport', () => {
  it('packages every file into one readable archive', async () => {
    const archive = await runExport(
      { doc: docWith(true), ground: 'light', stateId: 's0', targets: ['fav', 'mac', 'asvg'] },
      stubRasterise,
    );
    const entries = readZip(archive);
    expect(entries.map((e) => e.path)).toEqual([
      'favicon.ico',
      'favicon-16.png',
      'favicon-32.png',
      'favicon-48.png',
      'AppIcon.icns',
      'icon.svg',
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
    await buildFiles(
      { doc: docWith(), ground: 'light', stateId: 's0', targets: ['fav', 'win'] },
      counting,
    );
    expect(asked).toEqual([16, 24, 32, 48, 256]);
  });

  it('captures the state it is asked for', async () => {
    const doc: IconDoc = {
      ...docWith(),
      objects: [{ ...newObject('rect', 1, 512), motion: { takesPart: true, role: 'spins', pace: 1 } }],
    };
    let seen = '';
    const capture: Rasteriser = async (svg, sizes) => {
      seen = svg;
      return stubRasterise(svg, sizes);
    };
    await buildFiles({ doc, ground: 'light', stateId: 's1', targets: ['fav'] }, capture);
    expect(seen).toContain('rotate(110');
  });

  it('paints the ground it is asked for', async () => {
    let seen = '';
    const capture: Rasteriser = async (svg, sizes) => {
      seen = svg;
      return stubRasterise(svg, sizes);
    };
    await buildFiles(
      { doc: docWith(), ground: 'dark', stateId: 's0', targets: ['fav'] },
      capture,
    );
    expect(seen).toContain('#14130F');
  });

  it('writes nothing when nothing is selected', async () => {
    expect(readZip(await runExport({ doc: docWith(), ground: 'light', stateId: 's0', targets: [] }, stubRasterise))).toEqual([]);
  });
});
