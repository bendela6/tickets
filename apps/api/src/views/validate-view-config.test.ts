import { expect, test } from 'vitest';
import type { ProjectVocab } from '../vocab/load-project-vocab';
import { validateViewConfig } from './validate-view-config';

function fakeVocab(overrides: { fieldKeys: string[] }): ProjectVocab {
  return {
    fieldKeys: overrides.fieldKeys.map((key) => ({ key, label: key, type: 'text' })),
  } as unknown as ProjectVocab;
}

test('accepts known field keys and rejects unknown', () => {
  const vocab = fakeVocab({ fieldKeys: ['priority', 'status'] });
  expect(() =>
    validateViewConfig(vocab, { columns: [{ source: 'field', fieldKey: 'priority' }] }),
  ).not.toThrow();
  expect(() =>
    validateViewConfig(vocab, { columns: [{ source: 'field', fieldKey: 'nope' }] }),
  ).toThrow(/unknown/);
});

test('rejects an unknown field key in sort', () => {
  const vocab = fakeVocab({ fieldKeys: ['priority'] });
  expect(() =>
    validateViewConfig(vocab, { sort: { source: 'field', fieldKey: 'priority', dir: 'asc' } }),
  ).not.toThrow();
  expect(() =>
    validateViewConfig(vocab, { sort: { source: 'field', fieldKey: 'nope', dir: 'asc' } }),
  ).toThrow(/unknown/);
});

test('rejects an unknown field key nested in filters', () => {
  const vocab = fakeVocab({ fieldKeys: ['priority'] });
  expect(() =>
    validateViewConfig(vocab, { filters: { priority: { fieldKey: 'priority', eq: 'high' } } }),
  ).not.toThrow();
  expect(() =>
    validateViewConfig(vocab, { filters: { priority: { fieldKey: 'nope', eq: 'high' } } }),
  ).toThrow(/unknown/);
});

test('rejects an unknown field key in forward-compat extras', () => {
  const vocab = fakeVocab({ fieldKeys: ['priority'] });
  expect(() =>
    validateViewConfig(vocab, { grouping: { fieldKey: 'nope' } }),
  ).toThrow(/unknown/);
});

test('allows builtin columns and sort with no field keys involved', () => {
  const vocab = fakeVocab({ fieldKeys: [] });
  expect(() =>
    validateViewConfig(vocab, {
      columns: [{ source: 'number' }, { source: 'type' }],
      sort: { source: 'number', dir: 'desc' },
    }),
  ).not.toThrow();
});
