import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = dirname(fileURLToPath(import.meta.url));
const IMPORT = /(?:\bfrom|\bimport)\s*\(?\s*'([^']+)'/g;
const COMMENT = /\/\*[\s\S]*?\*\/|\/\/.*$/gm;
// What only a browser has: its window, its document and the elements on it.
const DOM =
  /\b(?:window|document|navigator|localStorage|sessionStorage|HTML\w*Element|Element|Node)\b/;

/** The module's own files, following its relative imports, and the packages they import. */
function graphOf(entry: string): { files: string[]; packages: Set<string> } {
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
      const path = resolve(dirname(file), specifier);
      visit(existsSync(`${path}.ts`) ? `${path}.ts` : resolve(path, 'index.ts'));
    }
  };
  visit(entry);
  return { files: [...seen], packages };
}

describe('the package’s main entry', () => {
  const { files, packages } = graphOf(resolve(SRC, 'index.ts'));

  // Servers and browsers both import it, so it takes @bh/registry, @bh/resource
  // and valibot alone: no React, nothing drawn with it, and nothing of Node's.
  it('imports @bh/registry, @bh/resource and valibot, and nothing else', () => {
    expect([...packages].sort()).toEqual(['@bh/registry', '@bh/resource', 'valibot']);
  });

  it('touches nothing of the DOM', () => {
    expect(files.length).toBeGreaterThan(1);
    for (const file of files) {
      const code = readFileSync(file, 'utf8').replace(COMMENT, '');
      expect(DOM.exec(code)?.[0], file).toBeUndefined();
    }
  });
});
