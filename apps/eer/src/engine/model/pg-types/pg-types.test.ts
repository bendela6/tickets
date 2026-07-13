import { describe, expect, it } from 'vitest';

import { PG_TYPES, formatType, parseType } from './pg-types';

describe('pg-types', () => {
  it('lists known postgres types with their param arity', () => {
    const byName = new Map(PG_TYPES.map((t) => [t.name, t]));
    expect(byName.get('int')!.params).toBe(0);
    expect(byName.get('varchar')!.params).toBe(1);
    expect(byName.get('numeric')!.params).toBe(2);
    expect(byName.get('timestamptz')!.group).toBe('temporal');
    expect(byName.get('jsonb')!.group).toBe('json');
  });

  it('parses a plain type', () => {
    expect(parseType('int')).toEqual({ base: 'int', params: [], custom: false });
  });

  it('parses parameterised types', () => {
    expect(parseType('varchar(255)')).toEqual({ base: 'varchar', params: ['255'], custom: false });
    expect(parseType('numeric(10,2)')).toEqual({ base: 'numeric', params: ['10', '2'], custom: false });
    expect(parseType('numeric( 10 , 2 )')).toEqual({ base: 'numeric', params: ['10', '2'], custom: false });
  });

  it('flags an unknown type as custom, keeping it verbatim', () => {
    expect(parseType('citext')).toEqual({ base: 'citext', params: [], custom: true });
    expect(parseType('my_enum')).toEqual({ base: 'my_enum', params: [], custom: true });
  });

  it('formats back, dropping empty params', () => {
    expect(formatType('int', [])).toBe('int');
    expect(formatType('varchar', ['255'])).toBe('varchar(255)');
    expect(formatType('numeric', ['10', '2'])).toBe('numeric(10,2)');
    expect(formatType('varchar', [''])).toBe('varchar');
  });

  it('roundtrips every catalogue type', () => {
    for (const t of PG_TYPES) {
      const params = t.params === 0 ? [] : t.params === 1 ? ['8'] : ['8', '2'];
      const s = formatType(t.name, params);
      const back = parseType(s);
      expect(back.base, s).toBe(t.name);
      expect(back.params, s).toEqual(params);
      expect(back.custom, s).toBe(false);
    }
  });
});
