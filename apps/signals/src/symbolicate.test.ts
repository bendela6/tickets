import { expect, it } from 'vitest';
import { symbolicateFrames } from './symbolicate';
import type { StackFrame } from './types';

// A tiny real source map: `function boom(){throw new Error("x")}` from src/boom.ts,
// generated with esbuild --minify --sourcemap. sourcesContent included.
const MAP = JSON.stringify({
  version: 3,
  sources: ['src/boom.ts'],
  sourcesContent: ['function boom() {\n  throw new Error("x");\n}\nboom();\n'],
  mappings: 'AAAA,SAAS,MAAO,CACd,MAAM,IAAI,MAAM,GAAG,CACrB,CACA,KAAK',
  names: [],
});

const minifiedFrame: StackFrame = {
  functionName: 'r', file: '/assets/index-8f3a91.js', line: 1, column: 21, inApp: false,
};

it('resolves a minified frame to the original source with context lines', () => {
  const out = symbolicateFrames([minifiedFrame], [{ filename: 'index-8f3a91.js.map', content: MAP }]);
  expect(out).not.toBeNull();
  expect(out![0]!.file).toContain('src/boom.ts');
  expect(out![0]!.line).toBe(2);
  expect(out![0]!.inApp).toBe(true);
  expect(out![0]!.contextLines!.map((l) => l.line)).toContain(2);
});

it('returns null when no artifact matches the frame file', () => {
  expect(symbolicateFrames([minifiedFrame], [{ filename: 'other.js.map', content: MAP }])).toBeNull();
});
