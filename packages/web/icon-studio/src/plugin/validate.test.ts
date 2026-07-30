import { decodePng, MAX_BYTES } from './validate';

// An 8-byte PNG signature followed by nothing else is enough for the check.
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const validPayload = Buffer.concat([PNG_SIG, Buffer.alloc(32)]).toString('base64');

test('accepts a payload carrying the PNG signature', () => {
  const out = decodePng(validPayload);
  expect(out.ok).toBe(true);
  if (out.ok) expect(out.bytes.subarray(0, 8)).toEqual(PNG_SIG);
});

test('strips a data: prefix if the client sent one', () => {
  const out = decodePng(`data:image/png;base64,${validPayload}`);
  expect(out.ok).toBe(true);
});

test('rejects bytes that are not a PNG', () => {
  const out = decodePng(Buffer.from('<svg/>').toString('base64'));
  expect(out).toEqual({ ok: false, reason: 'not a png' });
});

test('rejects a payload long enough to clear the length gate but bearing a different magic number', () => {
  const jpegSig = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
  const payload = Buffer.concat([jpegSig, Buffer.alloc(32)]).toString('base64');
  const out = decodePng(payload);
  expect(out).toEqual({ ok: false, reason: 'not a png' });
});

test('rejects an 8-byte payload matching the PNG signature everywhere except the last byte', () => {
  const almostSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x00]);
  const out = decodePng(almostSig.toString('base64'));
  expect(out).toEqual({ ok: false, reason: 'not a png' });
});

test('rejects a payload that is not valid base64', () => {
  expect(decodePng('!!!not base64!!!').ok).toBe(false);
});

test('rejects anything over the size cap', () => {
  const big = Buffer.concat([PNG_SIG, Buffer.alloc(MAX_BYTES)]).toString('base64');
  expect(decodePng(big)).toEqual({ ok: false, reason: 'too large' });
});

test('rejects an empty payload', () => {
  expect(decodePng('').ok).toBe(false);
});
