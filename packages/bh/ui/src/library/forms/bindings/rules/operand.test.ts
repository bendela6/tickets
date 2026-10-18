import { baseKinds, baseOperators, type OperatorSpec } from '@bh/resource';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { operandInput } from './operand';
import { CREATED, DUE, FIELDS, LABELS, SIZE, TITLE } from './rules.fixture';

const near: OperatorSpec = {
  name: 'near',
  label: 'is near',
  operand: () => v.number(),
  matches: () => true,
};
const operators = baseOperators.register({ near });
const meta = { fields: FIELDS, operators, kinds: baseKinds };
const spec = (name: string) => operators.get(name);

describe('the input a rule’s value is drawn with', () => {
  it('is a date for a date, and a datetime’s operand is its day’s first moment', () => {
    const date = operandInput(meta, DUE, spec('lt'));
    expect(date?.type).toBe('date');
    expect(date?.toOperand('2026-10-31')).toBe('2026-10-31');
    const datetime = operandInput(meta, CREATED, spec('lt'));
    expect(datetime?.type).toBe('date');
    expect(datetime?.toOperand('2026-10-31')).toBe('2026-10-31T00:00:00.000Z');
    expect(datetime?.toInput('2026-10-31T00:00:00.000Z')).toBe('2026-10-31');
  });

  it('is tags for several typed values, numbers parsed, and nothing until one is given', () => {
    const numbers = operandInput(meta, SIZE, spec('in'));
    expect(numbers?.type).toBe('tags');
    expect(numbers?.toOperand(['3', '5'])).toEqual([3, 5]);
    expect(numbers?.toOperand(['3', 'many'])).toBeUndefined();
    expect(numbers?.toOperand([])).toBeUndefined();
    expect(operandInput(meta, TITLE, spec('in'))?.toOperand(['a'])).toEqual(['a']);
  });

  it('is a multi-select for a list’s `in`, its operand the values', () => {
    const labels = operandInput(meta, LABELS, spec('in'));
    expect(labels?.type).toBe('multi-select');
    expect(labels?.toOperand(['api'])).toEqual(['api']);
    expect(labels?.toInput(['api', 'ui'])).toEqual(['api', 'ui']);
  });

  it('is text that commits as it is typed, and nothing while blank', () => {
    const title = operandInput(meta, TITLE, spec('contains'));
    expect(title).toMatchObject({ type: 'text', config: { commit: 'change' } });
    expect(title?.toOperand('  ')).toBeUndefined();
  });

  it('is the app’s own input for its own operator, as operatorInputs names it', () => {
    const own = operandInput({ ...meta, operatorInputs: { near: 'slider' } }, SIZE, near);
    expect(own?.type).toBe('slider');
    expect(own?.toOperand(4)).toBe(4);
    expect(own?.toOperand(null)).toBeUndefined();
  });

  it('is none for an operator that takes no value', () => {
    expect(operandInput(meta, DUE, spec('empty'))).toBeNull();
  });
});
