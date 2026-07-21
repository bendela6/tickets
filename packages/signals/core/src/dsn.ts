export interface ParsedDsn {
  key: string;
  appId: number;
  ingestUrl: string;
  sourcemapsUrl: string;
}

// sgl://<key>@<host[:port]>/<appId> → http; sgls:// → https.
export function parseDsn(dsn: string): ParsedDsn {
  const match = /^(sgl|sgls):\/\/([^@/]+)@([^/@]+)\/(\d+)$/.exec(dsn);
  if (!match) throw new Error(`invalid signals DSN: ${dsn}`);
  const [, scheme, key, host, appId] = match;
  const base = `${scheme === 'sgls' ? 'https' : 'http'}://${host}`;
  return {
    key: key!,
    appId: Number(appId),
    ingestUrl: `${base}/ingest/${key}`,
    sourcemapsUrl: `${base}/ingest/${key}/sourcemaps`,
  };
}
