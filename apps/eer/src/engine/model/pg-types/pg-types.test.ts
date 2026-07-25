import { describe, expect, it } from 'vitest';
import { getPgColumnBuilders } from 'drizzle-orm/pg-core/columns/all';

import { PG_TYPES, formatType, normalizeTypeName, parseType } from './pg-types';

describe('catalogue', () => {
  // The drift test: a drizzle upgrade that adds a builder turns this red rather
  // than leaving a silent hole in the picker.
  it('has a descriptor for every drizzle builder except the customType meta-factory', () => {
    const builders = Object.keys(getPgColumnBuilders()).filter((b) => b !== 'customType');
    const described = new Set(PG_TYPES.map((t) => t.builder));
    expect([...builders].filter((b) => !described.has(b))).toEqual([]);
  });

  it('offers nothing drizzle cannot build', () => {
    const names = PG_TYPES.map((t) => t.sqlName);
    // bytea is absent from this list on purpose: drizzle ships no `bytea()`
    // builder, but it CAN build the type through the customType meta-factory,
    // which export-drizzle emits as a helper declaration. The types below have
    // no route at all.
    for (const absent of ['box', 'path', 'polygon', 'circle', 'varbit']) {
      expect(names).not.toContain(absent);
    }
  });

  it('offers bytea through the customType meta-factory', () => {
    const bytea = PG_TYPES.find((t) => t.sqlName === 'bytea')!;
    expect(bytea).toBeDefined();
    expect(bytea.builder).toBe('customType');
    expect(bytea.group).toBe('binary');
    expect(parseType('bytea')).toEqual({ base: 'bytea', params: [], arrays: [], known: true });
  });

  it('offers the serial family — 16 columns of the real schema use it', () => {
    const names = PG_TYPES.map((t) => t.sqlName);
    expect(names).toContain('serial');
    expect(names).toContain('bigserial');
    expect(names).toContain('smallserial');
  });

  it('carries drizzle SQL names, with shorthand only as a display name', () => {
    const ts = PG_TYPES.find((t) => t.builder === 'timestamp')!;
    expect(ts.sqlName).toBe('timestamp');
    const tstz = PG_TYPES.find((t) => t.sqlName === 'timestamp with time zone')!;
    expect(tstz.displayName).toBe('timestamptz');
  });
});

describe('parseType', () => {
  it('parses a bare type', () => {
    expect(parseType('text')).toEqual({ base: 'text', params: [], arrays: [], known: true });
  });

  it('parses parameters', () => {
    expect(parseType('numeric(10,2)')).toEqual({ base: 'numeric', params: ['10', '2'], arrays: [], known: true });
  });

  it('parses array dimensions, sized and nested', () => {
    expect(parseType('text[]').arrays).toEqual([{ size: null }]);
    expect(parseType('integer[2]').arrays).toEqual([{ size: 2 }]);
    expect(parseType('integer[2][]').arrays).toEqual([{ size: 2 }, { size: null }]);
  });

  it('parses a multi-word type', () => {
    expect(parseType('timestamp with time zone').known).toBe(true);
  });

  // The picker renders known:false as an invalid selection that blocks export.
  it('marks an unrecognised type unknown but keeps its text verbatim', () => {
    expect(parseType('legacy_money')).toEqual({
      base: 'legacy_money', params: [], arrays: [], known: false,
    });
  });
});

describe('formatType', () => {
  it('round-trips every shape parseType produces', () => {
    for (const s of ['text', 'varchar(64)', 'numeric(10,2)', 'text[]', 'integer[2][]', 'timestamp with time zone']) {
      const p = parseType(s);
      expect(formatType(p.base, p.params, p.arrays)).toBe(s);
    }
  });
});

describe('normalizeTypeName', () => {
  it('maps legacy aliases onto drizzle-canonical names', () => {
    expect(normalizeTypeName('int')).toBe('integer');
    expect(normalizeTypeName('int4')).toBe('integer');
    expect(normalizeTypeName('int8')).toBe('bigint');
    expect(normalizeTypeName('bool')).toBe('boolean');
    expect(normalizeTypeName('decimal')).toBe('numeric');
    expect(normalizeTypeName('timestamptz')).toBe('timestamp with time zone');
    expect(normalizeTypeName('serial4')).toBe('serial');
  });

  it('leaves an unknown name alone', () => {
    expect(normalizeTypeName('legacy_money')).toBe('legacy_money');
  });
});
