import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parseDsn } from '@bendela6/signals-core';

export interface UploadSourcemapsOptions {
  dir: string;
  release: string;
  dsn: string;
  fetchFn?: typeof fetch;
}

export interface UploadSourcemapsResult {
  uploaded: string[];
}

const MAX_FILES_PER_REQUEST = 50;

function findMapFiles(dir: string): string[] {
  const found: string[] = [];

  function walk(current: string): void {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules') continue;
        walk(join(current, entry.name));
      } else if (entry.isFile() && entry.name.endsWith('.map')) {
        found.push(join(current, entry.name));
      }
    }
  }

  walk(dir);
  return found;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

export async function uploadSourcemaps(options: UploadSourcemapsOptions): Promise<UploadSourcemapsResult> {
  const { dir, release, dsn, fetchFn = fetch } = options;
  const { sourcemapsUrl } = parseDsn(dsn);

  const mapPaths = findMapFiles(dir);
  const files = mapPaths.map((path) => ({ filename: basename(path), content: readFileSync(path, 'utf8') }));

  const uploaded: string[] = [];
  for (const batch of chunk(files, MAX_FILES_PER_REQUEST)) {
    const response = await fetchFn(sourcemapsUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ release, files: batch }),
    } as RequestInit);
    if (response.status !== 201) {
      const detail = await response.text();
      throw new Error(`sourcemap upload failed: ${response.status} ${detail}`);
    }
    uploaded.push(...batch.map((f) => f.filename));
  }

  return { uploaded };
}
