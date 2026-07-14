import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { renderSql } from './render-sql';

describe('renderSql', () => {
  it('returns null for undefined and null', () => {
    expect(renderSql(undefined)).toBeNull();
    expect(renderSql(null)).toBeNull();
  });

  it('renders a sql template through the pg dialect', () => {
    expect(renderSql(sql`now()`)).toBe('now()');
  });

  it('renders a sql template with an embedded value', () => {
    expect(renderSql(sql`length(slug) > 0`)).toBe('length(slug) > 0');
  });

  it('quotes a plain string literal', () => {
    expect(renderSql('hello')).toBe("'hello'");
  });

  it('escapes a single quote in a string literal', () => {
    expect(renderSql("it's")).toBe("'it''s'");
  });

  it('renders numbers and booleans as bare text', () => {
    expect(renderSql(0)).toBe('0');
    expect(renderSql(42)).toBe('42');
    expect(renderSql(true)).toBe('true');
    expect(renderSql(false)).toBe('false');
  });

  it('renders a plain object as a jsonb literal', () => {
    expect(renderSql({ a: 1 })).toBe("'{\"a\":1}'::jsonb");
  });
});
