import { describe, expect, it } from 'vitest';
import { parseStack } from './stack-parse';

describe('parseStack', () => {
  it('parses V8 frames with and without function names', () => {
    const stack = [
      'TypeError: boom',
      '    at CartList (/app/src/checkout/CartList.tsx:48:13)',
      '    at /app/src/main.tsx:10:1',
      '    at async load (node:internal/modules/esm/loader:100:5)',
    ].join('\n');
    const frames = parseStack(stack);
    expect(frames).toEqual([
      { functionName: 'CartList', file: '/app/src/checkout/CartList.tsx', line: 48, column: 13, inApp: true },
      { functionName: '<anonymous>', file: '/app/src/main.tsx', line: 10, column: 1, inApp: true },
      { functionName: 'load', file: 'node:internal/modules/esm/loader', line: 100, column: 5, inApp: false },
    ]);
  });
  it('parses Firefox/Safari frames and vendor detection', () => {
    const frames = parseStack('boom@https://cdn.site/vendor/node_modules/lib.js:5:9\nrun@https://app.site/assets/index.js:1:100');
    expect(frames).toEqual([
      { functionName: 'boom', file: 'https://cdn.site/vendor/node_modules/lib.js', line: 5, column: 9, inApp: false },
      { functionName: 'run', file: 'https://app.site/assets/index.js', line: 1, column: 100, inApp: true },
    ]);
  });
  it('returns [] for undefined or unparseable stacks', () => {
    expect(parseStack(undefined)).toEqual([]);
    expect(parseStack('just a message\nwith lines')).toEqual([]);
  });
  it('honors a custom isInApp', () => {
    const frames = parseStack('    at f (/x/a.js:1:1)', () => false);
    expect(frames[0]!.inApp).toBe(false);
  });
});
