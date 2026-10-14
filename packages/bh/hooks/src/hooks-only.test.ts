import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// @bh/hooks sits below every other bh package: @bh/ui, @bh/table and
// @bh/shell import it, so it may import none of them, and an app that takes
// a hook takes nothing drawn with it. A hook holds state and behaviour; the
// component that calls it draws, with the styles of whichever package it is
// in. Those promises are only as good as the package's files, so this reads
// them.

const SRC = import.meta.dirname;
const ROOT = resolve(SRC, '..');
const IMPORT = /(?:\bfrom|\bimport)\s*\(?\s*'([^']+)'/g;
const COMMENT = /\/\*[\s\S]*?\*\/|\/\/.*$/gm;
/** What a hook may import: React, and nothing else. */
const HOOK_IMPORTS = new Set(['react']);
/** Folders that hold no file of the package's own. */
const NOT_OURS = new Set(['node_modules', 'dist', 'coverage']);

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return NOT_OURS.has(name) ? [] : filesUnder(path);
    }
    return [path];
  });
}

/** The package names a file imports; its relative imports are its own files. */
function packagesImportedBy(file: string): string[] {
  const code = readFileSync(file, 'utf8').replace(COMMENT, '');
  return [...code.matchAll(IMPORT)].flatMap(([, specifier = '']) => {
    return specifier.startsWith('.') ? [] : [specifier];
  });
}

const where = (file: string) => relative(ROOT, file).replaceAll('\\', '/');

/** A test, or what the tests share (`src/test/`): free to render a component. */
const isTest = (file: string) => /\.test\.tsx?$/.test(file) || where(file).startsWith('src/test/');

const code = filesUnder(SRC).filter((file) => /\.tsx?$/.test(file));
const hooks = code.filter((file) => !isTest(file));

const manifest = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')) as {
  exports: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

describe('@bh/hooks holds hooks only', () => {
  it('finds the package’s entry', () => {
    expect(manifest.exports).toEqual({ '.': './src/index.ts' });
    expect(hooks.map(where)).toContain('src/index.ts');
  });

  // A component is JSX, and a `.ts` file can't hold any: a test may draw one
  // to call a hook in, the hooks themselves never.
  it('draws nothing: every file but the tests is .ts', () => {
    expect(hooks.filter((file) => !file.endsWith('.ts')).map(where)).toEqual([]);
  });

  it('imports React and nothing else', () => {
    const others = hooks.flatMap((file) => {
      return packagesImportedBy(file)
        .filter((name) => !HOOK_IMPORTS.has(name))
        .map((name) => `${where(file)} -> ${name}`);
    });
    expect(others).toEqual([]);
  });

  it('has no stylesheet, and imports none', () => {
    const sheets = filesUnder(ROOT).filter((file) => /\.(css|scss|sass|less)$/.test(file));
    expect(sheets.map(where)).toEqual([]);
    expect(Object.values(manifest.exports).filter((target) => target.endsWith('.css'))).toEqual([]);
  });
});

describe('@bh/hooks is below every other bh package', () => {
  // Its tests too: a test that drew with @bh/ui would make the package need
  // the one above it that needs it.
  it('no file of it imports one', () => {
    const bh = code.flatMap((file) => {
      return packagesImportedBy(file)
        .filter((name) => name.startsWith('@bh/'))
        .map((name) => `${where(file)} -> ${name}`);
    });
    expect(bh).toEqual([]);
  });

  // @bh/config is the tooling every package builds with (its tsconfig, lint
  // and coverage presets), never imported by the code.
  it('depends on none, but for @bh/config’s tooling', () => {
    const bhOf = (deps: Record<string, string> = {}) => {
      return Object.keys(deps).filter((name) => name.startsWith('@bh/'));
    };
    expect(bhOf(manifest.dependencies)).toEqual([]);
    expect(bhOf(manifest.peerDependencies)).toEqual([]);
    expect(bhOf(manifest.devDependencies)).toEqual(['@bh/config']);
  });
});
