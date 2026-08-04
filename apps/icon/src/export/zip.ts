/**
 * A minimal ZIP writer.
 *
 * Store-method only — no compression. That is not a shortcut: PNG payloads are
 * already DEFLATE-compressed internally, so deflating them again buys almost
 * nothing, and storing them keeps this to about a hundred lines with no
 * dependency and nothing to go wrong at read time.
 *
 * Format: ISO/IEC 21320-1 / PKWARE APPNOTE. Every archive is
 * [local header + data]* + [central directory entry]* + end-of-central-directory.
 */

export interface ZipEntry {
  path: string;
  bytes: Uint8Array;
}

const LOCAL_SIGNATURE = 0x04034b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const END_SIGNATURE = 0x06054b50;
/** 2.0: the lowest version that reads what we write. */
const VERSION = 20;
/** Bit 11: filenames are UTF-8 rather than the legacy code page. */
const UTF8_FLAG = 0x800;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = (crc >>> 8) ^ (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

class ByteWriter {
  private parts: Uint8Array[] = [];
  length = 0;

  u16(value: number): void {
    this.push(new Uint8Array([value & 0xff, (value >>> 8) & 0xff]));
  }

  u32(value: number): void {
    this.push(
      new Uint8Array([
        value & 0xff,
        (value >>> 8) & 0xff,
        (value >>> 16) & 0xff,
        (value >>> 24) & 0xff,
      ]),
    );
  }

  push(bytes: Uint8Array): void {
    this.parts.push(bytes);
    this.length += bytes.length;
  }

  finish(): Uint8Array {
    const out = new Uint8Array(this.length);
    let at = 0;
    for (const part of this.parts) {
      out.set(part, at);
      at += part.length;
    }
    return out;
  }
}

/**
 * DOS date/time. Zip has no notion of a timezone and only 2-second precision;
 * a fixed timestamp keeps an export reproducible, which matters more here than
 * recording when the button was pressed — the same document must produce the
 * same bytes twice.
 */
const DOS_TIME = 0;
const DOS_DATE = 0x0021; // 1 Jan 1980, the epoch the format starts at.

export function createZip(entries: ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const body = new ByteWriter();
  const central = new ByteWriter();

  for (const entry of entries) {
    const name = encoder.encode(entry.path);
    const crc = crc32(entry.bytes);
    const offset = body.length;

    body.u32(LOCAL_SIGNATURE);
    body.u16(VERSION);
    body.u16(UTF8_FLAG);
    body.u16(0); // stored
    body.u16(DOS_TIME);
    body.u16(DOS_DATE);
    body.u32(crc);
    body.u32(entry.bytes.length);
    body.u32(entry.bytes.length);
    body.u16(name.length);
    body.u16(0); // no extra field
    body.push(name);
    body.push(entry.bytes);

    central.u32(CENTRAL_SIGNATURE);
    central.u16(VERSION); // made by
    central.u16(VERSION); // needed to extract
    central.u16(UTF8_FLAG);
    central.u16(0);
    central.u16(DOS_TIME);
    central.u16(DOS_DATE);
    central.u32(crc);
    central.u32(entry.bytes.length);
    central.u32(entry.bytes.length);
    central.u16(name.length);
    central.u16(0); // extra
    central.u16(0); // comment
    central.u16(0); // disk
    central.u16(0); // internal attributes
    central.u32(0); // external attributes
    central.u32(offset);
    central.push(name);
  }

  const out = new ByteWriter();
  const bodyBytes = body.finish();
  const centralBytes = central.finish();
  out.push(bodyBytes);
  out.push(centralBytes);
  out.u32(END_SIGNATURE);
  out.u16(0); // this disk
  out.u16(0); // disk with the central directory
  out.u16(entries.length);
  out.u16(entries.length);
  out.u32(centralBytes.length);
  out.u32(bodyBytes.length);
  out.u16(0); // no archive comment
  return out.finish();
}

/**
 * Walk an archive's central directory back out.
 *
 * Exported because it is what the tests read with: asserting a byte count
 * proves nothing about whether an unzip tool could open the file, and this
 * traverses the same structures one would.
 */
export function readZip(archive: Uint8Array): ZipEntry[] {
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  const decoder = new TextDecoder();

  // The end record is last, but may be followed by a comment, so scan back.
  let end = archive.length - 22;
  while (end >= 0 && view.getUint32(end, true) !== END_SIGNATURE) end--;
  if (end < 0) throw new Error('not a zip archive: no end-of-central-directory record');

  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const entries: ZipEntry[] = [];

  for (let i = 0; i < count; i++) {
    if (view.getUint32(at, true) !== CENTRAL_SIGNATURE) {
      throw new Error(`corrupt central directory at entry ${i}`);
    }
    const size = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const localOffset = view.getUint32(at + 42, true);
    const path = decoder.decode(archive.subarray(at + 46, at + 46 + nameLength));

    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataAt = localOffset + 30 + localNameLength + localExtraLength;
    entries.push({ path, bytes: archive.slice(dataAt, dataAt + size) });

    at += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}
