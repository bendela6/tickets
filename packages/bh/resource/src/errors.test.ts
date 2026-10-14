import * as v from 'valibot';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { issuesOf, type ErrorBody, type ErrorCode, type Issue } from './errors';
import { optionValue } from './schemas';

/** valibot's issues for `input` against `schema`, as an invalid answer's. */
function invalid(schema: v.GenericSchema, input: unknown): Issue[] {
  const result = v.safeParse(schema, input);
  return result.success ? [] : issuesOf(result.issues);
}

describe('the error shape', () => {
  it('names bh’s four codes', () => {
    expectTypeOf<ErrorCode>().toEqualTypeOf<'invalid' | 'not_found' | 'conflict' | 'internal'>();
    const missing: ErrorBody = { error: { code: 'not_found', message: 'item not found' } };
    // @ts-expect-error an error is an object with its code, never a bare string
    const bare: ErrorBody = { error: 'item not found' };
    // @ts-expect-error bh's routes answer bh's codes
    const unknown: ErrorBody = { error: { code: 'unauthorized', message: 'sign in' } };
    expect([missing, bare, unknown]).toHaveLength(3);
  });

  it('lets an app type in codes of its own', () => {
    const denied: ErrorBody<ErrorCode | 'unauthorized'> = {
      error: { code: 'unauthorized', message: 'sign in' },
    };
    expectTypeOf(denied.error.code).toEqualTypeOf<ErrorCode | 'unauthorized'>();
    expect(denied.error.code).toBe('unauthorized');
  });

  it('gives an invalid answer its issues, each by path and message', () => {
    const body: ErrorBody = {
      error: {
        code: 'invalid',
        message: 'the query is invalid',
        issues: [{ path: ['filter', 'all', 1, 'value'], message: 'status has no option "doing"' }],
      },
    };
    expectTypeOf<Issue['path']>().toEqualTypeOf<(string | number)[]>();
    expect(body.error.issues).toHaveLength(1);
  });
});

describe('issuesOf', () => {
  const status = optionValue({ options: [{ value: 'todo', label: 'To do', order: 0 }] });
  const query = v.object({
    filter: v.object({ all: v.array(v.object({ field: v.string(), value: status })) }),
  });

  it('flattens each path to the keys and indexes it went through', () => {
    const body = {
      filter: {
        all: [
          { field: 'status', value: 'todo' },
          { field: 'status', value: 'doing' },
        ],
      },
    };
    expect(invalid(query, body)).toEqual([
      { path: ['filter', 'all', 1, 'value'], message: 'no option "doing"' },
    ]);
  });

  it('answers one issue per problem', () => {
    const body = { filter: { all: [{ field: 7, value: 'doing' }] } };
    expect(invalid(query, body).map((issue) => issue.path)).toEqual([
      ['filter', 'all', 0, 'field'],
      ['filter', 'all', 0, 'value'],
    ]);
  });

  it('gives the body itself the empty path', () => {
    expect(invalid(query, 'all')).toEqual([{ path: [], message: expect.any(String) }]);
  });

  it('keeps a record’s key as it is, and shows a Map’s as its text', () => {
    expect(invalid(v.record(v.string(), v.number()), { estimate: 'x' })[0]?.path).toEqual([
      'estimate',
    ]);
    const map = v.map(v.boolean(), v.string());
    expect(invalid(map, new Map([[true, 8]]))[0]?.path).toEqual(['true']);
  });

  it('answers none for none', () => {
    expect(issuesOf([])).toEqual([]);
  });
});
