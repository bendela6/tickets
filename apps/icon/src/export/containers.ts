/**
 * The two icon container formats. Both are just PNGs in an envelope, which is
 * why neither needs a dependency.
 */

export interface SizedPng {
  size: number;
  bytes: Uint8Array;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function isPng(bytes: Uint8Array): boolean {
  return PNG_SIGNATURE.every((byte, i) => bytes[i] === byte);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/**
 * Windows `.ico`.
 *
 * A 6-byte header, one 16-byte directory entry per image, then the payloads.
 * Both the width and height bytes are single bytes with **0 meaning 256** —
 * the format predates icons that large, and writing 256 into a byte would
 * write 0 by accident and mean the right thing for the wrong reason.
 */
export function createIco(images: SizedPng[]): Uint8Array {
  if (images.length === 0) throw new Error('an .ico needs at least one image');

  const header = new Uint8Array(6);
  const headerView = new DataView(header.buffer);
  headerView.setUint16(0, 0, true); // reserved
  headerView.setUint16(2, 1, true); // 1 = icon
  headerView.setUint16(4, images.length, true);

  const directory = new Uint8Array(images.length * 16);
  const directoryView = new DataView(directory.buffer);
  let offset = 6 + directory.length;

  images.forEach((image, index) => {
    const at = index * 16;
    directory[at] = image.size >= 256 ? 0 : image.size;
    directory[at + 1] = image.size >= 256 ? 0 : image.size;
    directory[at + 2] = 0; // palette colours; 0 for truecolour
    directory[at + 3] = 0; // reserved
    directoryView.setUint16(at + 4, 1, true); // colour planes
    directoryView.setUint16(at + 6, 32, true); // bits per pixel
    directoryView.setUint32(at + 8, image.bytes.length, true);
    directoryView.setUint32(at + 12, offset, true);
    offset += image.bytes.length;
  });

  return concat([header, directory, ...images.map((image) => image.bytes)]);
}

/**
 * The `.icns` chunk type for each size Apple defines. A size with no type has
 * no home in the format and is dropped rather than guessed at.
 */
const ICNS_TYPES: Record<number, string> = {
  16: 'icp4',
  32: 'icp5',
  64: 'icp6',
  128: 'ic07',
  256: 'ic08',
  512: 'ic09',
  1024: 'ic10',
};

/**
 * macOS `.icns`.
 *
 * `icns` magic, the total length, then one chunk per image: a four-character
 * type, the chunk length *including its own 8-byte header*, and the PNG.
 * Everything is big-endian, unlike `.ico`.
 */
export function createIcns(images: SizedPng[]): Uint8Array {
  const chunks: Uint8Array[] = [];
  const encoder = new TextEncoder();

  for (const image of images) {
    const type = ICNS_TYPES[image.size];
    if (!type) continue;
    const chunk = new Uint8Array(8 + image.bytes.length);
    chunk.set(encoder.encode(type), 0);
    new DataView(chunk.buffer).setUint32(4, chunk.length, false);
    chunk.set(image.bytes, 8);
    chunks.push(chunk);
  }

  if (chunks.length === 0) throw new Error('an .icns needs at least one image at a supported size');

  const body = concat(chunks);
  const out = new Uint8Array(8 + body.length);
  out.set(encoder.encode('icns'), 0);
  new DataView(out.buffer).setUint32(4, out.length, false);
  out.set(body, 8);
  return out;
}

/** The sizes `createIcns` can actually carry, for callers choosing what to render. */
export const ICNS_SIZES: readonly number[] = Object.keys(ICNS_TYPES)
  .map(Number)
  .sort((a, b) => a - b);

export interface IcnsChunk {
  type: string;
  bytes: Uint8Array;
}

/** Read an `.icns` back out. What the tests assert against. */
export function readIcns(archive: Uint8Array): IcnsChunk[] {
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  const decoder = new TextDecoder();
  if (decoder.decode(archive.subarray(0, 4)) !== 'icns') throw new Error('not an icns file');

  const chunks: IcnsChunk[] = [];
  let at = 8;
  while (at + 8 <= archive.length) {
    const type = decoder.decode(archive.subarray(at, at + 4));
    const length = view.getUint32(at + 4, false);
    if (length < 8) throw new Error(`corrupt icns chunk "${type}"`);
    chunks.push({ type, bytes: archive.slice(at + 8, at + length) });
    at += length;
  }
  return chunks;
}

export interface IcoEntry {
  width: number;
  height: number;
  bytes: Uint8Array;
}

/** Read an `.ico` back out. What the tests assert against. */
export function readIco(archive: Uint8Array): IcoEntry[] {
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  if (view.getUint16(2, true) !== 1) throw new Error('not an ico file');
  const count = view.getUint16(4, true);

  const entries: IcoEntry[] = [];
  for (let i = 0; i < count; i++) {
    const at = 6 + i * 16;
    // 0 means 256 on the way out as well as the way in.
    const width = archive[at] === 0 ? 256 : (archive[at] ?? 0);
    const height = archive[at + 1] === 0 ? 256 : (archive[at + 1] ?? 0);
    const size = view.getUint32(at + 8, true);
    const offset = view.getUint32(at + 12, true);
    entries.push({ width, height, bytes: archive.slice(offset, offset + size) });
  }
  return entries;
}
