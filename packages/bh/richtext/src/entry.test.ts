import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = dirname(fileURLToPath(import.meta.url));
const IMPORT = /(?:\bfrom|\bimport)\s*\(?\s*'([^']+)'/g;
/** React, and what is drawn with it: Tiptap's React side and bh's components. */
const DRAWN = /^(react|react-dom|@tiptap\/react|@bh\/ui)(\/|$)/;

/** The file a relative import names: a module, or a folder's index. */
function fileOf(path: string): string {
  const file = [`${path}.ts`, `${path}.tsx`, resolve(path, 'index.ts')].find((name) => {
    return existsSync(name);
  });
  if (file === undefined) {
    throw new Error(`No module at ${path}`);
  }
  return file;
}

/** Every package the module imports, following its own files from there. */
function packagesImportedBy(entry: string): Set<string> {
  const packages = new Set<string>();
  const seen = new Set<string>();
  const visit = (file: string) => {
    if (seen.has(file)) {
      return;
    }
    seen.add(file);
    for (const [, specifier = ''] of readFileSync(file, 'utf8').matchAll(IMPORT)) {
      if (!specifier.startsWith('.')) {
        packages.add(specifier);
        continue;
      }
      visit(fileOf(resolve(dirname(file), specifier)));
    }
  };
  visit(entry);
  return packages;
}

const manifest = JSON.parse(readFileSync(resolve(SRC, '../package.json'), 'utf8')) as {
  exports: Record<string, string>;
};

describe('the package’s main entry', () => {
  // Servers import it: React, or anything drawn with it, goes in an entry of its own.
  it('imports nothing of React, nor bh’s components', () => {
    expect(manifest.exports['.']).toBe('./src/index.ts');
    const packages = [...packagesImportedBy(resolve(SRC, 'index.ts'))];
    expect(packages).toContain('@tiptap/core');
    expect(packages.filter((name) => DRAWN.test(name))).toEqual([]);
  });
});

describe('the editor’s entry', () => {
  it('is an entry of its own, and the one that brings React', () => {
    expect(manifest.exports['./editor']).toBe('./src/editor/index.ts');
    const packages = [...packagesImportedBy(resolve(SRC, 'editor/index.ts'))];
    expect(packages).toEqual(expect.arrayContaining(['react', '@tiptap/react', '@bh/ui']));
  });
});
