import { describe, expect, test } from 'vitest';
import { depsKey } from './deps-key';

describe('depsKey', () => {
  test('returns "{}" for empty deps', () => {
    expect(depsKey({})).toBe('{}');
  });

  test('serializes simple deps', () => {
    expect(depsKey({ country: 'US' })).toBe('{"country":"US"}');
  });

  test('is stable across key insertion order', () => {
    expect(depsKey({ a: 1, b: 2 })).toBe(depsKey({ b: 2, a: 1 }));
  });

  test('serializes nested objects with sorted keys', () => {
    const a = depsKey({ filter: { z: 1, a: 2 } });
    const b = depsKey({ filter: { a: 2, z: 1 } });
    expect(a).toBe(b);
  });

  test('distinguishes different values', () => {
    expect(depsKey({ a: 1 })).not.toBe(depsKey({ a: 2 }));
  });

  test('handles undefined and null', () => {
    expect(depsKey({ a: undefined })).toBe('{"a":null}');
    expect(depsKey({ a: null })).toBe('{"a":null}');
  });

  test('handles arrays', () => {
    expect(depsKey({ a: [3, 1, 2] })).toBe('{"a":[3,1,2]}');
  });
});
