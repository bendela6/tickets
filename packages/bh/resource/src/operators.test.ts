import * as v from 'valibot';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { baseKinds } from './kinds';
import { baseOperators, operatorLabel } from './operators';
import type { OperatorSpec } from './types';
import type { Scalar } from './values';

function operator(name: string): OperatorSpec {
  const spec = baseOperators.find((each) => each.name === name);
  if (!spec) {
    throw new Error(`bh registers no operator "${name}"`);
  }
  return spec;
}

/** Whether a row holding `value` passes `name` with this operand. */
function passes(name: string, value: Scalar | Scalar[] | null, operand?: Scalar | Scalar[]) {
  return operator(name).matches(value, operand);
}

/** The operand's schema `name` makes for a field of this kind. */
function operandOf(name: string, kind: string) {
  const spec = baseKinds.find((each) => each.name === kind);
  const make = operator(name).operand;
  if (!spec || !make) {
    throw new Error(`no operand for "${name}" on ${kind}`);
  }
  return make(spec.value());
}

describe('bh’s operators', () => {
  it('are fifteen entries, each once, each with its label', () => {
    expect(baseOperators.map((spec) => [spec.name, spec.label])).toEqual([
      ['equals', 'is'],
      ['notEquals', 'is not'],
      ['in', 'is any of'],
      ['notIn', 'is none of'],
      ['contains', 'contains'],
      ['startsWith', 'starts with'],
      ['lt', 'is less than'],
      ['lte', 'is at most'],
      ['gt', 'is more than'],
      ['gte', 'is at least'],
      ['inLast', 'is in the last'],
      ['notInLast', 'is not in the last'],
      ['empty', 'is empty'],
      ['notEmpty', 'is not empty'],
      ['isMe', 'is me'],
    ]);
  });

  it('are frozen: an app adds its own beside them, never changes them', () => {
    expect(() => (baseOperators as OperatorSpec[]).push(operator('in'))).toThrow(TypeError);
    expect(() => {
      operator('in').label = 'is one of';
    }).toThrow(TypeError);
    expect(() => {
      Object.assign(operator('lt').labels?.kinds ?? {}, { number: 'is under' });
    }).toThrow(TypeError);
  });

  it('have words of their own for dates and for lists', () => {
    const words = baseOperators
      .filter((spec) => spec.labels)
      .map((spec) => [spec.name, spec.labels]);
    expect(words).toEqual([
      ['in', { many: 'has any of' }],
      ['notIn', { many: 'has none of' }],
      ['lt', { kinds: { date: 'is before', datetime: 'is before' } }],
      ['lte', { kinds: { date: 'is on or before', datetime: 'is on or before' } }],
      ['gt', { kinds: { date: 'is after', datetime: 'is after' } }],
      ['gte', { kinds: { date: 'is on or after', datetime: 'is on or after' } }],
    ]);
  });
});

describe('operatorLabel', () => {
  it('reads an operator by its words for the field’s kind', () => {
    expect(operatorLabel(operator('lt'), { kind: 'date' })).toBe('is before');
    expect(operatorLabel(operator('gte'), { kind: 'datetime' })).toBe('is on or after');
  });

  it('or for a field holding a list', () => {
    expect(operatorLabel(operator('in'), { kind: 'option', many: true })).toBe('has any of');
    expect(operatorLabel(operator('notIn'), { kind: 'text', many: true })).toBe('has none of');
  });

  it('or by its label', () => {
    expect(operatorLabel(operator('lt'), { kind: 'number' })).toBe('is less than');
    expect(operatorLabel(operator('in'), { kind: 'option' })).toBe('is any of');
    expect(operatorLabel(operator('empty'), { kind: 'option', many: true })).toBe('is empty');
  });

  it('puts a kind’s words before a list’s', () => {
    const tags: OperatorSpec = {
      name: 'tagged',
      label: 'is tagged',
      labels: { kinds: { text: 'is labelled' }, many: 'has the tag' },
      matches: () => true,
    };
    expect(operatorLabel(tags, { kind: 'text', many: true })).toBe('is labelled');
    expect(operatorLabel(tags, { kind: 'url', many: true })).toBe('has the tag');
  });
});

describe('each operator’s operand', () => {
  it('is the field’s own value for equals, notEquals and the ranges', () => {
    for (const name of ['equals', 'notEquals', 'lt', 'lte', 'gt', 'gte']) {
      expect(v.is(operandOf(name, 'number'), 3), name).toBe(true);
      expect(v.is(operandOf(name, 'number'), '3'), name).toBe(false);
      expect(v.is(operandOf(name, 'date'), '2026-10-12'), name).toBe(true);
      expect(v.is(operandOf(name, 'date'), '2026-10-32'), name).toBe(false);
    }
  });

  it('is 1 to 100 of the field’s values for in and notIn', () => {
    const hundred = Array.from({ length: 100 }, (_, at) => at);
    for (const name of ['in', 'notIn']) {
      expect(v.is(operandOf(name, 'number'), [1]), name).toBe(true);
      expect(v.is(operandOf(name, 'number'), hundred), name).toBe(true);
      expect(v.is(operandOf(name, 'number'), []), name).toBe(false);
      expect(v.is(operandOf(name, 'number'), [...hundred, 100]), name).toBe(false);
      expect(v.is(operandOf(name, 'number'), ['1']), name).toBe(false);
      expect(v.is(operandOf(name, 'number'), 1), name).toBe(false);
    }
  });

  it('is an option field’s own options for in', () => {
    const kind = baseKinds.find((each) => each.name === 'option');
    const settings = { options: [{ value: 'todo', label: 'To do', order: 0 }] };
    const schema = operator('in').operand?.(kind?.value(settings) ?? v.never()) ?? v.never();
    expect(v.is(schema, ['todo'])).toBe(true);
    expect(v.is(schema, ['doing'])).toBe(false);
  });

  it('is 1 to 200 characters for contains and startsWith, whatever the field’s kind', () => {
    for (const name of ['contains', 'startsWith']) {
      expect(v.is(operandOf(name, 'url'), 'login'), name).toBe(true);
      expect(v.is(operandOf(name, 'url'), 'x'.repeat(200)), name).toBe(true);
      expect(v.is(operandOf(name, 'url'), ''), name).toBe(false);
      expect(v.is(operandOf(name, 'url'), 'x'.repeat(201)), name).toBe(false);
      expect(v.is(operandOf(name, 'url'), 7), name).toBe(false);
    }
  });

  it('is a whole number of days, 1 or more, for inLast and notInLast', () => {
    for (const name of ['inLast', 'notInLast']) {
      expect(v.is(operandOf(name, 'date'), 7), name).toBe(true);
      expect(v.is(operandOf(name, 'datetime'), 1), name).toBe(true);
      expect(v.is(operandOf(name, 'date'), 0), name).toBe(false);
      expect(v.is(operandOf(name, 'date'), 1.5), name).toBe(false);
      expect(v.is(operandOf(name, 'date'), '7'), name).toBe(false);
      expect(v.is(operandOf(name, 'date'), '2026-10-07'), name).toBe(false);
    }
  });

  it('is none for empty, notEmpty and isMe', () => {
    expect(operator('empty').operand).toBeUndefined();
    expect(operator('notEmpty').operand).toBeUndefined();
    expect(operator('isMe').operand).toBeUndefined();
  });
});

describe('matches', () => {
  it('equals the value, and notEquals keeps the rows without one', () => {
    expect(passes('equals', 'done', 'done')).toBe(true);
    expect(passes('equals', 'todo', 'done')).toBe(false);
    expect(passes('equals', null, 'done')).toBe(false);
    expect(passes('equals', 7, '7')).toBe(false);
    expect(passes('notEquals', 'todo', 'done')).toBe(true);
    expect(passes('notEquals', 'done', 'done')).toBe(false);
    expect(passes('notEquals', null, 'done')).toBe(true);
  });

  it('holds in when the row holds any of the values, and notIn when none, keeping rows without one', () => {
    expect(passes('in', 'todo', ['todo', 'active'])).toBe(true);
    expect(passes('in', 'done', ['todo', 'active'])).toBe(false);
    expect(passes('in', null, ['todo'])).toBe(false);
    expect(passes('notIn', 'done', ['todo', 'active'])).toBe(true);
    expect(passes('notIn', 'todo', ['todo', 'active'])).toBe(false);
    expect(passes('notIn', null, ['todo'])).toBe(true);
  });

  it('on a many field, holds in for any of its values, notIn for none, empty for none at all', () => {
    expect(passes('in', ['bug', 'ui'], ['ui', 'api'])).toBe(true);
    expect(passes('in', ['bug', 'docs'], ['ui', 'api'])).toBe(false);
    expect(passes('in', [], ['ui'])).toBe(false);
    expect(passes('notIn', ['bug', 'docs'], ['ui', 'api'])).toBe(true);
    expect(passes('notIn', ['bug', 'ui'], ['ui', 'api'])).toBe(false);
    expect(passes('notIn', [], ['ui'])).toBe(true);
    expect(passes('empty', [])).toBe(true);
    expect(passes('empty', ['bug'])).toBe(false);
    expect(passes('notEmpty', ['bug'])).toBe(true);
    expect(passes('notEmpty', [])).toBe(false);
  });

  it('finds text with contains and startsWith, case ignored', () => {
    expect(passes('contains', 'Fix the Login', 'login')).toBe(true);
    expect(passes('contains', 'Fix the login', 'LOGIN fix')).toBe(false);
    expect(passes('startsWith', 'Fix the login', 'fix')).toBe(true);
    expect(passes('startsWith', 'Fix the login', 'login')).toBe(false);
    expect(passes('contains', null, 'login')).toBe(false);
    expect(passes('startsWith', '', 'a')).toBe(false);
  });

  it('on a many field, finds text when one of its values holds it', () => {
    expect(passes('contains', ['backend', 'Frontend'], 'front')).toBe(true);
    expect(passes('startsWith', ['backend', 'frontend'], 'front')).toBe(true);
    expect(passes('contains', ['back', 'end'], 'k,e')).toBe(false);
    expect(passes('contains', [], 'a')).toBe(false);
  });

  it('compares a number by value, passing no row without one', () => {
    expect(passes('lt', 2, 3)).toBe(true);
    expect(passes('lt', 3, 3)).toBe(false);
    expect(passes('lte', 3, 3)).toBe(true);
    expect(passes('gt', 10, 9)).toBe(true);
    expect(passes('gt', 9, 10)).toBe(false);
    expect(passes('gte', 9, 9)).toBe(true);
    expect(passes('lt', -1.5, 0)).toBe(true);
    for (const name of ['lt', 'lte', 'gt', 'gte']) {
      expect(passes(name, null, 3), name).toBe(false);
      expect(passes(name, '2', 3), name).toBe(false);
    }
  });

  it('compares a date by day', () => {
    expect(passes('lt', '2026-10-11', '2026-10-12')).toBe(true);
    expect(passes('lt', '2026-10-12', '2026-10-12')).toBe(false);
    expect(passes('lte', '2026-10-12', '2026-10-12')).toBe(true);
    expect(passes('gt', '2027-01-01', '2026-12-31')).toBe(true);
    expect(passes('gte', '2026-09-30', '2026-10-01')).toBe(false);
    expect(passes('equals', '2026-10-12', '2026-10-12')).toBe(true);
  });

  it('compares a datetime by instant, whatever its fraction’s digits', () => {
    expect(passes('lt', '2026-11-01T00:00:00.000Z', '2026-11-01T00:00:00Z')).toBe(false);
    expect(passes('gte', '2026-11-01T00:00:00Z', '2026-11-01T00:00:00.000Z')).toBe(true);
    expect(passes('lte', '2026-11-01T00:00:00.000000Z', '2026-11-01T00:00:00Z')).toBe(true);
    expect(passes('gt', '2026-10-12T09:30:00.5Z', '2026-10-12T09:30:00.123Z')).toBe(true);
    expect(passes('lt', '2026-10-12T09:30:00.000001Z', '2026-10-12T09:30:00.00001Z')).toBe(true);
  });

  it('takes a month as gte its first moment and lt the next month’s', () => {
    const october = (at: string) => {
      return (
        passes('gte', at, '2026-10-01T00:00:00.000Z') &&
        passes('lt', at, '2026-11-01T00:00:00.000Z')
      );
    };
    expect(october('2026-10-01T00:00:00Z')).toBe(true);
    expect(october('2026-10-31T23:59:59.999999999Z')).toBe(true);
    expect(october('2026-11-01T00:00:00Z')).toBe(false);
    expect(october('2026-09-30T23:59:59.999Z')).toBe(false);
  });

  it('finds empty only null, or [] on a many field: an empty text and a zero are values', () => {
    expect(passes('empty', null)).toBe(true);
    expect(passes('notEmpty', null)).toBe(false);
    for (const value of ['', 0, false, 'x']) {
      expect(passes('empty', value), String(value)).toBe(false);
      expect(passes('notEmpty', value), String(value)).toBe(true);
    }
  });

  it('holds isMe for the rows that point at the person viewing them', () => {
    const isMe = operator('isMe').matches;
    expect(isMe(7, undefined, 7)).toBe(true);
    expect(isMe(8, undefined, 7)).toBe(false);
    expect(isMe('u-7', undefined, 'u-7')).toBe(true);
    expect(isMe(null, undefined, 7)).toBe(false);
  });

  it('on a many field, holds isMe when the person viewing is one of its values', () => {
    const isMe = operator('isMe').matches;
    expect(isMe([3, 7], undefined, 7)).toBe(true);
    expect(isMe([3, 8], undefined, 7)).toBe(false);
    expect(isMe([], undefined, 7)).toBe(false);
  });

  it('holds isMe for no row when no one is signed in', () => {
    const isMe = operator('isMe').matches;
    expect(isMe(7)).toBe(false);
    expect(isMe([7])).toBe(false);
    expect(isMe(null)).toBe(false);
  });

  it('gives every other operator the viewer too, which it doesn’t look at', () => {
    expect(operator('equals').matches('done', 'done', 7)).toBe(true);
    expect(operator('empty').matches(null, undefined, 7)).toBe(true);
  });
});

describe('inLast and notInLast', () => {
  // Now is 14 October 2026, 09:30 UTC, so 7 days ago is 7 October at 09:30.
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-14T09:30:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('count a datetime by instant, from the moment that many days ago', () => {
    expect(passes('inLast', '2026-10-07T09:30:00Z', 7)).toBe(true);
    expect(passes('inLast', '2026-10-07T09:29:59.999Z', 7)).toBe(false);
    expect(passes('inLast', '2026-10-13T18:00:00.000Z', 1)).toBe(true);
    expect(passes('inLast', '2026-10-13T09:00:00.000Z', 1)).toBe(false);
    expect(passes('notInLast', '2026-10-07T09:29:59.999Z', 7)).toBe(true);
    expect(passes('notInLast', '2026-10-07T09:30:00.000Z', 7)).toBe(false);
  });

  it('count a date by day, from that moment’s day', () => {
    expect(passes('inLast', '2026-10-07', 7)).toBe(true);
    expect(passes('inLast', '2026-10-06', 7)).toBe(false);
    expect(passes('inLast', '2026-10-14', 7)).toBe(true);
    expect(passes('notInLast', '2026-10-06', 7)).toBe(true);
    expect(passes('notInLast', '2026-10-07', 7)).toBe(false);
  });

  it('keep rolling with the clock, as a saved “last 7 days” view does', () => {
    expect(passes('inLast', '2026-10-07', 7)).toBe(true);
    vi.setSystemTime(new Date('2026-10-15T09:30:00.000Z'));
    expect(passes('inLast', '2026-10-07', 7)).toBe(false);
  });

  it('pass a row without a value through notInLast only', () => {
    expect(passes('inLast', null, 7)).toBe(false);
    expect(passes('notInLast', null, 7)).toBe(true);
  });
});
