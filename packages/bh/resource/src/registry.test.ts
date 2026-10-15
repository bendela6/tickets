import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { baseKinds } from './kinds';
import { baseOperators } from './operators';
import { createKindRegistry, createOperatorRegistry, createRegistry } from './registry';
import type { FormatSpec, KindSpec, OperatorSpec } from './types';
import type { Scalar } from './values';

// An app's own operator: between two values, both included, as `[low, high]`.
const between: OperatorSpec = {
  name: 'between',
  label: 'is between',
  operand: (value) => v.tuple([value, value]),
  matches: (a, b) => {
    const [low, high] = Array.isArray(b) ? b : [];
    const inside = (x: Scalar | undefined, y: Scalar | undefined) => {
      return typeof x === typeof y && x !== undefined && y !== undefined && x <= y;
    };
    return !Array.isArray(a) && a !== null && inside(low, a) && inside(a, high);
  },
};

// An app's own kind: a color, written as #rrggbb.
const color: KindSpec = {
  name: 'color',
  value: () => v.pipe(v.string(), v.hexColor()),
  many: false,
  operators: ['equals', 'notEquals', 'in', 'notIn', 'empty', 'notEmpty'],
  sort: false,
  group: true,
  search: false,
};

describe('createKindRegistry', () => {
  it('holds bh’s fifteen, in their table’s order', () => {
    const registry = createKindRegistry();
    expect(registry.kinds.map((spec) => spec.name)).toEqual([
      'text',
      'markdown',
      'richtext',
      'url',
      'email',
      'phone',
      'number',
      'boolean',
      'date',
      'time',
      'datetime',
      'option',
      'ref',
      'file',
      'json',
    ]);
    expect(registry.get('option')).toBe(baseKinds[11]);
  });

  it('knows no user kind: a person is a ref of users', () => {
    expect(createKindRegistry().get('user')).toBeUndefined();
  });

  it('registers an app’s own kind beside bh’s, and finds it by name', () => {
    const registry = createKindRegistry([color]);
    expect(registry.kinds).toHaveLength(baseKinds.length + 1);
    expect(registry.kinds.at(-1)).toBe(color);
    expect(registry.get('color')).toBe(color);
    expect(registry.get('text')).toBe(baseKinds[0]);
    const value = registry.get('color')?.value() ?? v.never();
    expect(v.is(value, '#3366ff')).toBe(true);
    expect(v.is(value, 'blue')).toBe(false);
  });

  it('takes an app kind with settings, and operators of its own once registered', () => {
    const money: KindSpec = {
      name: 'money',
      settings: v.strictObject({ currency: v.pipe(v.string(), v.length(3)) }),
      value: () => v.pipe(v.number(), v.integer()),
      many: false,
      operators: ['equals', 'lt', 'gt', 'between'],
      sort: true,
      group: false,
      search: false,
      format: 'money',
    };
    const registry = createKindRegistry([money], createOperatorRegistry([between]));
    expect(registry.get('money')?.operators).toContain('between');
    expect(v.is(registry.get('money')?.settings ?? v.never(), { currency: 'EUR' })).toBe(true);
  });

  it('refuses a kind allowing an operator nothing registered, so a misspelling fails at start', () => {
    expect(() => createKindRegistry([{ ...color, operators: ['equals', 'between'] }])).toThrow(
      'The kind "color" allows "between", but no operator is registered by that name.',
    );
    expect(() => createKindRegistry([{ ...color, operators: ['equal'] }])).toThrow(
      'allows "equal"',
    );
  });

  it('checks bh’s kinds against the operators it is given', () => {
    const without = { operators: [], get: () => undefined };
    expect(() => createKindRegistry([], without)).toThrow('The kind "text" allows "equals"');
  });

  it('keeps one app’s kinds out of another registry', () => {
    createKindRegistry([color]);
    expect(createKindRegistry().get('color')).toBeUndefined();
  });

  it('refuses a kind named as one of bh’s, so none is replaced unseen', () => {
    expect(() => createKindRegistry([{ ...color, name: 'text' }])).toThrow(
      'bh registers the kind "text" itself',
    );
  });

  it('refuses two of the app’s kinds named alike', () => {
    expect(() => createKindRegistry([color, { ...color }])).toThrow('Two kinds are named "color"');
  });

  it('refuses a kind without a name, or naming an operator twice or not by a word', () => {
    expect(() => createKindRegistry([{ ...color, name: '' }])).toThrow('named by a word');
    expect(() => createKindRegistry([{ ...color, name: ' color' }])).toThrow('named by a word');
    expect(() => createKindRegistry([{ ...color, operators: ['equals', 'equals'] }])).toThrow(
      'allows "equals" twice',
    );
    expect(() => createKindRegistry([{ ...color, operators: [''] }])).toThrow(
      'an operator is named by a word',
    );
  });

  it('hands out a registry that can’t be changed', () => {
    const registry = createKindRegistry([color]);
    expect(() => (registry.kinds as KindSpec[]).push(color)).toThrow(TypeError);
  });
});

describe('createOperatorRegistry', () => {
  it('holds bh’s fifteen, in their order', () => {
    const registry = createOperatorRegistry();
    expect(registry.operators.map((spec) => spec.name)).toEqual([
      'equals',
      'notEquals',
      'in',
      'notIn',
      'contains',
      'startsWith',
      'lt',
      'lte',
      'gt',
      'gte',
      'inLast',
      'notInLast',
      'empty',
      'notEmpty',
      'isMe',
    ]);
    expect(registry.get('in')).toBe(baseOperators[2]);
    expect(registry.get('between')).toBeUndefined();
  });

  it('registers an app’s own operator beside bh’s, and finds it by name', () => {
    const registry = createOperatorRegistry([between]);
    expect(registry.operators).toHaveLength(baseOperators.length + 1);
    expect(registry.operators.at(-1)).toBe(between);
    expect(registry.get('between')?.matches(5, [1, 10])).toBe(true);
    expect(registry.get('between')?.matches(11, [1, 10])).toBe(false);
    const operand = registry.get('between')?.operand?.(v.number()) ?? v.never();
    expect(v.is(operand, [1, 10])).toBe(true);
    expect(v.is(operand, [1])).toBe(false);
  });

  it('keeps one app’s operators out of another registry', () => {
    createOperatorRegistry([between]);
    expect(createOperatorRegistry().get('between')).toBeUndefined();
  });

  it('refuses an operator named as one of bh’s, so none is replaced unseen', () => {
    expect(() => createOperatorRegistry([{ ...between, name: 'in' }])).toThrow(
      'bh registers the operator "in" itself',
    );
  });

  it('refuses two of the app’s operators named alike', () => {
    expect(() => createOperatorRegistry([between, { ...between }])).toThrow(
      'Two operators are named "between"',
    );
  });

  it('refuses an operator without a name, a label or its matches', () => {
    expect(() => createOperatorRegistry([{ ...between, name: '' }])).toThrow('named by a word');
    expect(() => createOperatorRegistry([{ ...between, name: 'between ' }])).toThrow(
      'named by a word',
    );
    expect(() => createOperatorRegistry([{ ...between, label: ' ' }])).toThrow('has no label');
    expect(() => createOperatorRegistry([{ ...between, labels: { many: '' } }])).toThrow(
      'words in its labels that say nothing',
    );
    const blank = { ...between, labels: { kinds: { date: ' ' } } };
    expect(() => createOperatorRegistry([blank])).toThrow('words in its labels that say nothing');
    const dated = { ...between, labels: { kinds: { date: 'is between the days' } } };
    expect(createOperatorRegistry([dated]).get('between')?.labels).toEqual(dated.labels);
    const noMatches = { ...between, matches: undefined } as unknown as OperatorSpec;
    expect(() => createOperatorRegistry([noMatches])).toThrow('has no matches');
    const badOperand = { ...between, operand: v.string() } as unknown as OperatorSpec;
    expect(() => createOperatorRegistry([badOperand])).toThrow('from a function');
  });

  it('takes an operator with no operand, as empty is', () => {
    const blank: OperatorSpec = { name: 'blank', label: 'is blank', matches: (a) => a === '' };
    expect(createOperatorRegistry([blank]).get('blank')?.matches('')).toBe(true);
  });

  it('hands out a registry that can’t be changed', () => {
    const registry = createOperatorRegistry([between]);
    expect(() => (registry.operators as OperatorSpec[]).push(between)).toThrow(TypeError);
  });
});

describe('createRegistry', () => {
  // A format as @bh/template's entries are (TK-79.4): a FormatSpec and its function.
  interface Formatter extends FormatSpec {
    format: (value: unknown) => string;
  }
  const bytes: Formatter = {
    name: 'bytes',
    kinds: ['number'],
    format: (value) => `${String(value)} B`,
  };

  it('holds bh’s kinds and operators, and no format until one is passed in', () => {
    const registry = createRegistry();
    expect(registry.kinds).toEqual(baseKinds);
    expect(registry.operators).toEqual(baseOperators);
    expect(registry.formats).toEqual([]);
  });

  it('registers an app’s kinds, operators and formats beside bh’s, handing formats back as given', () => {
    const registry = createRegistry({ kinds: [color], operators: [between], formats: [bytes] });
    expect(registry.kinds.at(-1)).toBe(color);
    expect(registry.operators.at(-1)).toBe(between);
    expect(registry.formats[0]?.format(512)).toBe('512 B');
  });

  it('checks the kinds against the operators as it is built', () => {
    expect(() => createRegistry({ kinds: [{ ...color, operators: ['between'] }] })).toThrow(
      'The kind "color" allows "between", but no operator is registered by that name.',
    );
    const both = createRegistry({
      kinds: [{ ...color, operators: ['between'] }],
      operators: [between],
    });
    expect(both.kinds.at(-1)?.operators).toEqual(['between']);
  });

  it('refuses a format named twice, not by a word, taking no kind or one nothing registered', () => {
    expect(() => createRegistry({ formats: [bytes, { ...bytes }] })).toThrow(
      'Two formats are named "bytes"',
    );
    expect(() => createRegistry({ formats: [{ ...bytes, name: 'my bytes ' }] })).toThrow(
      'A format is named by a word',
    );
    expect(() => createRegistry({ formats: [{ ...bytes, kinds: [] }] })).toThrow(
      'The format "bytes" takes no kind.',
    );
    expect(() => createRegistry({ formats: [{ ...bytes, kinds: ['color'] }] })).toThrow(
      'The format "bytes" takes "color", but no kind is registered by that name.',
    );
    expect(
      createRegistry({ kinds: [color], formats: [{ ...bytes, kinds: ['color'] }] }).formats,
    ).toHaveLength(1);
    const options = 'currency' as unknown as v.GenericSchema;
    expect(() => createRegistry({ formats: [{ ...bytes, options }] })).toThrow(
      'checks its options with a valibot schema',
    );
  });

  it('hands out a registry that can’t be changed', () => {
    const registry = createRegistry({ formats: [bytes] });
    expect(() => (registry.formats as Formatter[]).push(bytes)).toThrow(TypeError);
    expect(Object.isFrozen(registry)).toBe(true);
  });
});
