import { describe, expect, expectTypeOf, it } from 'vitest';
import type { FieldValue } from './values';
import type { Create, Patch } from './writes';

describe('the writes’ shapes', () => {
  it('create a row from its values, by field key', () => {
    const item: Create = { values: { title: 'Fix the login', status: 'todo', labels: ['ui'] } };
    expectTypeOf<Create['values']>().toEqualTypeOf<Record<string, FieldValue>>();
    // @ts-expect-error the values sit under `values`
    const flat: Create = { title: 'Fix the login' };
    expect([item, flat]).toHaveLength(2);
  });

  it('patch the values that change, clearing one with null or []', () => {
    const patch: Patch = { values: { assignee: null, labels: [], status: 'done' } };
    expect(Object.keys(patch.values)).toEqual(['assignee', 'labels', 'status']);
  });

  it('carry the version the client read, as text, beside the values', () => {
    const checked: Patch = {
      values: { status: 'done' },
      version: '2026-10-14T00:53:56.753Z',
    };
    expectTypeOf<Patch['version']>().toEqualTypeOf<string | undefined>();
    // A field called version is a value like any other.
    const release: Patch = { values: { version: '2.0' }, version: '2026-10-14T00:53:56.753Z' };
    // @ts-expect-error a version is the text the client read
    const numbered: Patch = { values: {}, version: 3 };
    // @ts-expect-error a create has no version: there is no row to have changed
    const versioned: Create = { values: {}, version: '2026-10-14T00:53:56.753Z' };
    expect([checked, release, numbered, versioned]).toHaveLength(4);
  });
});
