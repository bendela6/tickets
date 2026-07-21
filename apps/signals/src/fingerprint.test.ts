import { describe, expect, it } from 'vitest';
import { culpritFrom, fingerprintError, issueTitle, normalizeMessage } from './fingerprint';
import type { StackFrame } from './types';

describe('normalizeMessage', () => {
  it.each([
    ['timeout of 5000ms exceeded', 'timeout of <n>ms exceeded'],
    ['user 550e8400-e29b-41d4-a716-446655440000 not found', 'user <uuid> not found'],
    ['bad address 0x7fff5fbff8c0', 'bad address <hex>'],
    ['chunk deadbeefcafe failed', 'chunk <hash> failed'],
    ['no digits here', 'no digits here'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeMessage(input)).toBe(expected);
  });
});

const frame = (functionName: string, file: string, inApp = true): StackFrame => ({
  functionName, file, line: 10, column: 5, inApp,
});

describe('fingerprintError', () => {
  it('is stable across differing line numbers and message numerals', () => {
    const a = fingerprintError({ name: 'TypeError', message: 'x is 5', stack: [{ ...frame('f', 'src/a.ts'), line: 10 }] });
    const b = fingerprintError({ name: 'TypeError', message: 'x is 9', stack: [{ ...frame('f', 'src/a.ts'), line: 99 }] });
    expect(a).toBe(b);
  });

  it('differs when the error type differs', () => {
    expect(fingerprintError({ name: 'TypeError', message: 'boom' }))
      .not.toBe(fingerprintError({ name: 'RangeError', message: 'boom' }));
  });

  it('uses only the top 5 in-app frames', () => {
    const inApp = Array.from({ length: 5 }, (_, i) => frame(`f${i}`, `src/${i}.ts`));
    const a = fingerprintError({ name: 'E', stack: [...inApp, frame('deep', 'src/deep.ts')] });
    const b = fingerprintError({ name: 'E', stack: [...inApp, frame('other', 'src/other.ts')] });
    expect(a).toBe(b);
  });

  it('ignores vendor frames', () => {
    const a = fingerprintError({ name: 'E', stack: [frame('f', 'src/a.ts'), frame('v', 'node_modules/x.js', false)] });
    const b = fingerprintError({ name: 'E', stack: [frame('f', 'src/a.ts'), frame('w', 'node_modules/y.js', false)] });
    expect(a).toBe(b);
  });

  it('honors an explicit fingerprint override', () => {
    expect(fingerprintError({ name: 'E', explicit: 'my-group' })).toBe('my-group');
  });
});

describe('culpritFrom', () => {
  it('prefers the top in-app frame', () => {
    expect(culpritFrom([frame('v', 'node_modules/x.js', false), frame('f', 'src/checkout/CartList.tsx')]))
      .toBe('src/checkout/CartList.tsx:10');
  });
  it('falls back to the top frame, and null without a stack', () => {
    expect(culpritFrom([frame('v', '/assets/index.js', false)])).toBe('/assets/index.js:10');
    expect(culpritFrom(undefined)).toBeNull();
  });
});

describe('issueTitle', () => {
  it('joins name and message, capping length', () => {
    expect(issueTitle('TypeError', 'boom')).toBe('TypeError — boom');
    expect(issueTitle('TypeError', undefined)).toBe('TypeError');
    expect(issueTitle('E', 'x'.repeat(500)).length).toBeLessThanOrEqual(203);
  });
});
