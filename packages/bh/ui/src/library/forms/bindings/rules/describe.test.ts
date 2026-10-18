import { baseKinds, baseOperators } from '@bh/resource';
import { describe, expect, it } from 'vitest';
import { conditionWords, dayLabel, entryWords, groupParts } from './describe';
import { FIELDS } from './rules.fixture';

const meta = { fields: FIELDS, operators: baseOperators, kinds: baseKinds };

describe('a rule in words', () => {
  it('reads a day as day and month, and its year when it isn’t this one', () => {
    const now = new Date('2026-06-01T00:00:00Z');
    expect(dayLabel('2026-10-31', now)).toBe('31 Oct');
    expect(dayLabel('2025-01-02T00:00:00.000Z', now)).toBe('2 Jan 2025');
  });

  it('counts the days of inLast', () => {
    expect(conditionWords(meta, { field: 'due', op: 'inLast', value: 7 })).toBe(
      'Due is in the last 7 days',
    );
    expect(conditionWords(meta, { field: 'due', op: 'inLast', value: 1 })).toBe(
      'Due is in the last 1 day',
    );
  });

  it('reads a field it doesn’t know by its path, and an operator it doesn’t know by its name', () => {
    expect(conditionWords(meta, { field: 'gone', op: 'equals', value: 'x' })).toBe('gone is x');
    expect(conditionWords(meta, { field: 'size', op: 'near', value: 3 })).toBe('Size near 3');
  });
});

describe('a group in words', () => {
  it('joins an any group by “or”, an all group by “and”, and puts “not:” before what it turns round', () => {
    const me = { field: 'owner', op: 'isMe' };
    const nobody = { field: 'owner', op: 'empty' };
    expect(entryWords(meta, { any: [me, nobody] })).toBe('Owner is me or Owner is empty');
    expect(entryWords(meta, { not: { field: 'priority', op: 'equals', value: 'low' } })).toBe(
      'not: Priority is Low',
    );
    // A group inside another is in brackets.
    expect(
      entryWords(meta, { all: [{ field: 'pinned', op: 'empty' }, { any: [me, nobody] }] }),
    ).toBe('Pinned is empty and (Owner is me or Owner is empty)');
  });

  it('gives a group’s parts and the word between them, as its chip draws them', () => {
    const me = { field: 'owner', op: 'isMe' };
    expect(groupParts(meta, { any: [me, { field: 'owner', op: 'empty' }] })).toEqual({
      joint: 'or',
      parts: ['Owner is me', 'Owner is empty'],
    });
    expect(groupParts(meta, { not: { any: [me, { field: 'pinned', op: 'empty' }] } })).toEqual({
      joint: 'not',
      parts: ['(Owner is me or Pinned is empty)'],
    });
  });
});
