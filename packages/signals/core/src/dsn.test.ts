import { describe, expect, it } from 'vitest';
import { parseDsn } from './dsn';

describe('parseDsn', () => {
  it('parses sgl:// into http endpoints', () => {
    expect(parseDsn('sgl://pub_4f9c21ab@127.0.0.1:4640/3')).toEqual({
      key: 'pub_4f9c21ab',
      appId: 3,
      ingestUrl: 'http://127.0.0.1:4640/ingest/pub_4f9c21ab',
      sourcemapsUrl: 'http://127.0.0.1:4640/ingest/pub_4f9c21ab/sourcemaps',
    });
  });
  it('parses sgls:// into https endpoints', () => {
    expect(parseDsn('sgls://k@signals.example.com/12').ingestUrl).toBe('https://signals.example.com/ingest/k');
  });
  it.each(['', 'sgl://nokey/1', 'sgl://k@host', 'http://k@host/1', 'sgl://k@host/notanumber'])(
    'rejects %s',
    (bad) => expect(() => parseDsn(bad)).toThrow(/invalid signals DSN/),
  );
});
