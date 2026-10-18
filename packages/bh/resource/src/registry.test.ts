import * as v from 'valibot';
import { defineRegistry } from '@bh/registry';
import { describe, expect, it } from 'vitest';
import { baseKinds } from './kinds';
import { baseOperators } from './operators';
import { createRegistry, formatData } from './registry';
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

describe('baseKinds', () => {
  it('holds bh’s fifteen, in their table’s order', () => {
    expect(baseKinds.names).toEqual([
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
    expect(baseKinds.get('option').name).toBe('option');
  });

  it('knows no user kind: a person is a ref of users', () => {
    expect(baseKinds.has('user')).toBe(false);
    expect(() => baseKinds.get('user')).toThrow('No kind is registered as "user".');
  });

  it('registers an app’s own kind beside bh’s in a new registry, leaving bh’s as they are', () => {
    const kinds = baseKinds.register({ color });
    expect(kinds.names).toHaveLength(baseKinds.names.length + 1);
    expect(kinds.values().at(-1)).toBe(color);
    expect(kinds.get('text')).toBe(baseKinds.get('text'));
    expect(baseKinds.has('color')).toBe(false);
    const value = kinds.get('color').value();
    expect(v.is(value, '#3366ff')).toBe(true);
    expect(v.is(value, 'blue')).toBe(false);
  });

  it('refuses a kind named as one of bh’s, so none is replaced unseen', () => {
    expect(() => baseKinds.register({ text: { ...color, name: 'text' } })).toThrow(
      'A kind is registered as "text" already',
    );
  });

  it('refuses a kind without a name, a value schema, or naming an operator twice or not by a word', () => {
    expect(() => baseKinds.register({ ' color': { ...color, name: ' color' } })).toThrow(
      'kind " color": name: is a word, with no space around it',
    );
    const noValue = { ...color, value: undefined } as unknown as KindSpec;
    expect(() => baseKinds.register({ color: noValue })).toThrow('its value schema is a function');
    const twice = { ...color, operators: ['equals', 'equals'] };
    expect(() => baseKinds.register({ color: twice })).toThrow(
      'kind "color": operators: names each operator once',
    );
    expect(() => baseKinds.register({ color: { ...color, operators: [''] } })).toThrow(
      'operators.0: is a word',
    );
  });
});

describe('baseOperators', () => {
  it('holds bh’s fifteen, in their order', () => {
    expect(baseOperators.names).toEqual([
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
    expect(baseOperators.get('in').label).toBe('is any of');
    expect(baseOperators.has('between')).toBe(false);
  });

  it('registers an app’s own operator beside bh’s in a new registry', () => {
    const operators = baseOperators.register({ between });
    expect(operators.values().at(-1)).toBe(between);
    expect(operators.get('between').matches(5, [1, 10])).toBe(true);
    expect(operators.get('between').matches(11, [1, 10])).toBe(false);
    const operand = operators.get('between').operand?.(v.number()) ?? v.never();
    expect(v.is(operand, [1, 10])).toBe(true);
    expect(v.is(operand, [1])).toBe(false);
    expect(baseOperators.has('between')).toBe(false);
  });

  it('refuses an operator named as one of bh’s, so none is replaced unseen', () => {
    expect(() => baseOperators.register({ in: { ...between, name: 'in' } })).toThrow(
      'An operator is registered as "in" already',
    );
  });

  it('refuses an operator without a name, a label or its matches', () => {
    const named = (spec: OperatorSpec) => baseOperators.register({ [spec.name]: spec });
    expect(() => named({ ...between, name: 'between ' })).toThrow('name: is a word');
    expect(() => named({ ...between, label: ' ' })).toThrow('label: says something');
    expect(() => named({ ...between, labels: { many: '' } })).toThrow(
      'labels.many: says something',
    );
    const blank = { ...between, labels: { kinds: { date: ' ' } } };
    expect(() => named(blank)).toThrow('labels.kinds.date: says something');
    const dated = { ...between, labels: { kinds: { date: 'is between the days' } } };
    expect(named(dated).get('between').labels).toEqual(dated.labels);
    const noMatches = { ...between, matches: undefined } as unknown as OperatorSpec;
    expect(() => named(noMatches)).toThrow('matches: its matches is a function');
    const badOperand = { ...between, operand: v.string() } as unknown as OperatorSpec;
    expect(() => named(badOperand)).toThrow('operand: its operand is a function');
  });

  it('takes an operator with no operand, as empty is', () => {
    const blank: OperatorSpec = { name: 'blank', label: 'is blank', matches: (a) => a === '' };
    expect(baseOperators.register({ blank }).get('blank').matches('')).toBe(true);
  });
});

describe('createRegistry', () => {
  // A format as @bh/template's entries are (TK-79.4): a FormatSpec and its function.
  interface Formatter extends FormatSpec {
    format: (value: unknown) => string;
  }
  const formats = defineRegistry<Formatter>({ name: 'format', schema: formatData });
  const bytes: Formatter = {
    name: 'bytes',
    kinds: ['number'],
    format: (value) => `${String(value)} B`,
  };

  it('holds bh’s kinds and operators, and no format until one is passed in', () => {
    const registry = createRegistry();
    expect(registry.kinds).toBe(baseKinds);
    expect(registry.operators).toBe(baseOperators);
    expect(registry.formats.names).toEqual([]);
  });

  it('holds the app’s kinds, operators and formats, handing formats back as given', () => {
    const registry = createRegistry({
      kinds: baseKinds.register({ color }),
      operators: baseOperators.register({ between }),
      formats: formats.register({ bytes }),
    });
    expect(registry.kinds.get('color')).toBe(color);
    expect(registry.operators.get('between')).toBe(between);
    expect(registry.formats.get('bytes').format(512)).toBe('512 B');
  });

  it('checks the kinds against the operators as it is built, so a misspelling fails at start', () => {
    const kinds = baseKinds.register({ color: { ...color, operators: ['between'] } });
    expect(() => createRegistry({ kinds })).toThrow(
      'The kind "color" allows "between", but no operator is registered by that name.',
    );
    const both = createRegistry({ kinds, operators: baseOperators.register({ between }) });
    expect(both.kinds.get('color').operators).toEqual(['between']);
    const without = defineRegistry<OperatorSpec>({ name: 'operator' });
    expect(() => createRegistry({ operators: without })).toThrow('The kind "text" allows "equals"');
  });

  it('checks the formats against the kinds as it is built', () => {
    const colored = formats.register({ bytes: { ...bytes, kinds: ['color'] } });
    expect(() => createRegistry({ formats: colored })).toThrow(
      'The format "bytes" takes "color", but no kind is registered by that name.',
    );
    const kinds = baseKinds.register({ color });
    expect(createRegistry({ kinds, formats: colored }).formats.names).toEqual(['bytes']);
  });

  it('checks a format by formatData: a word for its name, a kind at least, options a schema', () => {
    expect(() => formats.register({ 'my bytes ': { ...bytes, name: 'my bytes ' } })).toThrow(
      'name: is a word',
    );
    expect(() => formats.register({ bytes: { ...bytes, kinds: [] } })).toThrow(
      'format "bytes": kinds: takes a kind at least',
    );
    const options = 'currency' as unknown as v.GenericSchema;
    expect(() => formats.register({ bytes: { ...bytes, options } })).toThrow(
      'options: is a valibot schema',
    );
  });

  it('hands out a registry that can’t be changed', () => {
    expect(Object.isFrozen(createRegistry({ formats: formats.register({ bytes }) }))).toBe(true);
  });
});
