import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// @bh/shell is the frame of several different apps — gateway, the media-stack
// dashboard, the items console it came from — so nothing in it may know what
// any app is about. The app hands its meaning in (the nav list, the brand, the
// footer); the moment a row learns what a crawl or a torrent is, every other
// app inherits it.
//
// Stricter than @bh/ui's guard: any occurrence in code counts, identifiers
// included, not only string values. Comments are free to explain.

const SRC = import.meta.dirname;

const DOMAIN_WORDS = [
  // the items console
  'crawl',
  'merchant',
  'product',
  'scrape',
  'workflow',
  // the media dashboard
  'torrent',
  'movie',
  'radarr',
  'sonarr',
  'prowlarr',
  'plex',
  'seerr',
  'bazarr',
  'subtitle',
];

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      sourceFiles(full, out);
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe('@bh/shell stays domain-free', () => {
  it('names nothing from either app it frames', () => {
    const offenders: { file: string; match: string }[] = [];
    const word = new RegExp(DOMAIN_WORDS.join('|'), 'gi');
    for (const file of sourceFiles(SRC)) {
      const rel = path.relative(SRC, file).replaceAll('\\', '/');
      const src = readFileSync(file, 'utf8');
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      for (const match of code.matchAll(word)) {
        offenders.push({ file: rel, match: match[0] });
      }
    }
    expect(offenders).toEqual([]);
  });
});
