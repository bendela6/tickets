import { describe, expect, it } from 'vitest';
import { createIcns, createIco, ICNS_SIZES, isPng, readIcns, readIco } from './containers';
import { createZip, crc32, readZip } from './zip';

const bytesOf = (text: string) => new TextEncoder().encode(text);

/** A PNG signature followed by filler — enough to assert an envelope carried it. */
const fakePng = (size: number): Uint8Array => {
  const bytes = new Uint8Array(16 + size);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes[8] = size & 0xff;
  return bytes;
};

describe('crc32', () => {
  it('matches the published check value', () => {
    // The standard CRC-32 of "123456789".
    expect(crc32(bytesOf('123456789'))).toBe(0xcbf43926);
  });
  it('is zero for no bytes', () => {
    expect(crc32(new Uint8Array())).toBe(0);
  });
});

describe('createZip', () => {
  it('round-trips names and bytes through the central directory', () => {
    const entries = [
      { path: 'favicon.ico', bytes: bytesOf('one') },
      { path: 'icons/icon-512.png', bytes: bytesOf('two') },
    ];
    const read = readZip(createZip(entries));
    expect(read.map((e) => e.path)).toEqual(['favicon.ico', 'icons/icon-512.png']);
    expect(new TextDecoder().decode(read[1]!.bytes)).toBe('two');
  });

  it('survives an empty file, which the summary can legitimately produce', () => {
    const read = readZip(createZip([{ path: 'empty.txt', bytes: new Uint8Array() }]));
    expect(read[0]?.bytes).toHaveLength(0);
  });

  it('writes a readable archive with no entries at all', () => {
    expect(readZip(createZip([]))).toEqual([]);
  });

  it('handles non-ASCII names, which the UTF-8 flag is there for', () => {
    const read = readZip(createZip([{ path: 'ünïcode/名前.png', bytes: bytesOf('x') }]));
    expect(read[0]?.path).toBe('ünïcode/名前.png');
  });

  it('preserves binary payloads byte for byte', () => {
    const payload = new Uint8Array(512);
    for (let i = 0; i < payload.length; i++) payload[i] = (i * 7) % 256;
    const read = readZip(createZip([{ path: 'blob.bin', bytes: payload }]));
    expect(Array.from(read[0]!.bytes)).toEqual(Array.from(payload));
  });

  it('is reproducible — the same input twice gives the same bytes', () => {
    const entries = [{ path: 'a.png', bytes: bytesOf('a') }];
    expect(Array.from(createZip(entries))).toEqual(Array.from(createZip(entries)));
  });

  it('rejects something that is not an archive rather than returning nonsense', () => {
    expect(() => readZip(bytesOf('definitely not a zip'))).toThrow(/not a zip archive/);
  });
});

describe('createIco', () => {
  it('carries each PNG at the size it declares', () => {
    const entries = readIco(
      createIco([
        { size: 16, bytes: fakePng(16) },
        { size: 32, bytes: fakePng(32) },
        { size: 48, bytes: fakePng(48) },
      ]),
    );
    expect(entries.map((e) => e.width)).toEqual([16, 32, 48]);
    expect(entries.every((e) => isPng(e.bytes))).toBe(true);
  });

  it('writes 256 as the byte 0, which is what the format means by it', () => {
    const archive = createIco([{ size: 256, bytes: fakePng(256) }]);
    expect(archive[6]).toBe(0);
    expect(readIco(archive)[0]?.width).toBe(256);
  });

  it('points every entry at payload that is actually there', () => {
    const images = [
      { size: 16, bytes: fakePng(16) },
      { size: 32, bytes: fakePng(90) },
    ];
    const entries = readIco(createIco(images));
    expect(entries[1]?.bytes.length).toBe(images[1]?.bytes.length);
  });

  it('refuses to write an icon with no images', () => {
    expect(() => createIco([])).toThrow(/at least one image/);
  });
});

describe('createIcns', () => {
  it('gives each size its own four-character chunk type', () => {
    const chunks = readIcns(
      createIcns([
        { size: 16, bytes: fakePng(16) },
        { size: 512, bytes: fakePng(512) },
      ]),
    );
    expect(chunks.map((c) => c.type)).toEqual(['icp4', 'ic09']);
    expect(chunks.every((c) => isPng(c.bytes))).toBe(true);
  });

  it('declares a total length that matches the file', () => {
    const archive = createIcns([{ size: 128, bytes: fakePng(128) }]);
    expect(new DataView(archive.buffer).getUint32(4, false)).toBe(archive.length);
  });

  it('drops a size the format has no chunk type for, rather than guessing one', () => {
    const chunks = readIcns(
      createIcns([
        { size: 20, bytes: fakePng(20) },
        { size: 256, bytes: fakePng(256) },
      ]),
    );
    expect(chunks.map((c) => c.type)).toEqual(['ic08']);
  });

  it('refuses to write a file where every size was dropped', () => {
    expect(() => createIcns([{ size: 20, bytes: fakePng(20) }])).toThrow(/supported size/);
  });

  it('publishes the sizes it can carry, in order', () => {
    expect(ICNS_SIZES).toEqual([16, 32, 64, 128, 256, 512, 1024]);
  });
});
