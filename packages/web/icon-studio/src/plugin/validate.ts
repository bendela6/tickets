/** One megabyte. A 512px icon of three strokes is a few kilobytes. */
export const MAX_BYTES = 1_048_576;

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export type Decoded = { ok: true; bytes: Buffer } | { ok: false; reason: string };

/**
 * Decodes a base64 PNG payload and proves it is a PNG by its signature rather
 * than by trusting the filename.
 */
export function decodePng(payload: string): Decoded {
  const base64 = payload.replace(/^data:image\/png;base64,/, '');
  if (base64.length === 0) return { ok: false, reason: 'empty payload' };
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return { ok: false, reason: 'not base64' };

  const bytes = Buffer.from(base64, 'base64');
  if (bytes.byteLength > MAX_BYTES) return { ok: false, reason: 'too large' };
  if (bytes.byteLength < PNG_SIGNATURE.byteLength) return { ok: false, reason: 'not a png' };
  if (!bytes.subarray(0, PNG_SIGNATURE.byteLength).equals(PNG_SIGNATURE)) {
    return { ok: false, reason: 'not a png' };
  }
  return { ok: true, bytes };
}
