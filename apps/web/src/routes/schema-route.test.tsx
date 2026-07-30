import { describe, expect, it } from 'vitest';
import { schemaRoute } from './schema-route';

describe('schemaRoute search params', () => {
  const validate = schemaRoute.options.validateSearch as (
    s: Record<string, unknown>,
  ) => { database?: string };

  it('keeps a database name', () => {
    expect(validate({ database: 'tickets_dev' })).toEqual({ database: 'tickets_dev' });
  });

  it('drops an empty database name', () => {
    expect(validate({ database: '' })).toEqual({});
  });

  it('drops a non-string database', () => {
    expect(validate({ database: 42 })).toEqual({});
  });

  it('drops unrelated params', () => {
    expect(validate({ other: 'x' })).toEqual({});
  });
});
