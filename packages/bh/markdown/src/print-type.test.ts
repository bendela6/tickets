import { describe, expect, it } from 'vitest';
import { printType } from './print-type';

describe('printType', () => {
  it('prints an object: required and optional fields, each described one with its JSDoc', () => {
    const schema = {
      type: 'object',
      properties: {
        type: { enum: ['note', 'tip'], description: 'How much it matters.' },
        title: { type: 'string' },
        'data-id': { type: 'integer' },
      },
      required: ['type'],
    };
    expect(printType('CalloutModel', schema)).toBe(
      [
        'type CalloutModel = {',
        '  /** How much it matters. */',
        "  type: 'note' | 'tip';",
        '  title?: string;',
        '  "data-id"?: number;',
        '};',
      ].join('\n'),
    );
  });

  it('prints a list of objects, a list of a union, a record, a const and an any-of', () => {
    expect(
      printType('Rows', {
        type: 'array',
        items: {
          type: 'object',
          properties: { keys: { type: 'array', items: { type: 'string' } } },
          required: ['keys'],
        },
      }),
    ).toBe(['type Rows = {', '  keys: string[];', '}[];'].join('\n'));
    expect(
      printType('Mixed', {
        type: 'array',
        items: { anyOf: [{ type: 'string' }, { type: 'number' }] },
      }),
    ).toBe('type Mixed = (string | number)[];');
    expect(printType('Map', { type: 'object', additionalProperties: { type: 'boolean' } })).toBe(
      'type Map = Record<string, boolean>;',
    );
    expect(printType('One', { const: "it's" })).toBe("type One = 'it\\'s';");
    expect(printType('Many', { type: ['string', 'null'] })).toBe('type Many = string | null;');
  });

  it('nests an object inside an object, indented', () => {
    const schema = {
      type: 'object',
      properties: {
        tables: {
          type: 'object',
          additionalProperties: {
            type: 'object',
            properties: { pk: { type: 'boolean' } },
          },
        },
      },
      required: ['tables'],
    };
    expect(printType('Erd', schema)).toBe(
      ['type Erd = {', '  tables: Record<string, {', '    pk?: boolean;', '  }>;', '};'].join('\n'),
    );
  });

  it('prints a shape it does not know as unknown, rather than failing', () => {
    expect(printType('Odd', { not: {} })).toBe('type Odd = unknown;');
    expect(printType('None', undefined)).toBe('type None = unknown;');
  });
});
