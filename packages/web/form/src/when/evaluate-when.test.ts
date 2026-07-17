import { describe, expect, test } from 'vitest';
import { evaluateWhen } from './evaluate-when';
import type { WhenClause } from '../types/when';

describe('evaluateWhen', () => {
  test('eq returns true on match', () => {
    expect(evaluateWhen({ field: 'a', eq: 1 }, { a: 1 })).toBe(true);
  });

  test('eq returns false on mismatch', () => {
    expect(evaluateWhen({ field: 'a', eq: 1 }, { a: 2 })).toBe(false);
  });

  test('neq inverts eq', () => {
    expect(evaluateWhen({ field: 'a', neq: 1 }, { a: 2 })).toBe(true);
    expect(evaluateWhen({ field: 'a', neq: 1 }, { a: 1 })).toBe(false);
  });

  test('in matches when value is in list', () => {
    expect(evaluateWhen({ field: 'a', in: [1, 2, 3] }, { a: 2 })).toBe(true);
    expect(evaluateWhen({ field: 'a', in: [1, 2, 3] }, { a: 4 })).toBe(false);
  });

  test('truthy follows JS truthiness', () => {
    expect(evaluateWhen({ field: 'a', truthy: true }, { a: 'x' })).toBe(true);
    expect(evaluateWhen({ field: 'a', truthy: true }, { a: '' })).toBe(false);
    expect(evaluateWhen({ field: 'a', truthy: true }, { a: 0 })).toBe(false);
    expect(evaluateWhen({ field: 'a', truthy: true }, { a: undefined })).toBe(false);
  });

  test('all requires every child true', () => {
    const c: WhenClause = {
      all: [
        { field: 'a', eq: 1 },
        { field: 'b', eq: 2 },
      ],
    };
    expect(evaluateWhen(c, { a: 1, b: 2 })).toBe(true);
    expect(evaluateWhen(c, { a: 1, b: 3 })).toBe(false);
  });

  test('any requires at least one child true', () => {
    const c: WhenClause = {
      any: [
        { field: 'a', eq: 1 },
        { field: 'b', eq: 2 },
      ],
    };
    expect(evaluateWhen(c, { a: 1, b: 9 })).toBe(true);
    expect(evaluateWhen(c, { a: 9, b: 9 })).toBe(false);
  });

  test('not inverts', () => {
    expect(evaluateWhen({ not: { field: 'a', eq: 1 } }, { a: 2 })).toBe(true);
    expect(evaluateWhen({ not: { field: 'a', eq: 1 } }, { a: 1 })).toBe(false);
  });

  test('nested all/any/not', () => {
    const c: WhenClause = {
      all: [
        { field: 'country', eq: 'US' },
        { any: [{ field: 'role', eq: 'admin' }, { not: { field: 'banned', truthy: true } }] },
      ],
    };
    expect(evaluateWhen(c, { country: 'US', role: 'admin', banned: true })).toBe(true);
    expect(evaluateWhen(c, { country: 'US', role: 'user', banned: false })).toBe(true);
    expect(evaluateWhen(c, { country: 'US', role: 'user', banned: true })).toBe(false);
    expect(evaluateWhen(c, { country: 'CA', role: 'admin', banned: false })).toBe(false);
  });
});
