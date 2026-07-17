import { describe, expect, it } from 'vitest';
import { classifySchema } from './schema-classify';

describe('classifySchema', () => {
  it('classifies the items schema by its item_values marker', () => {
    expect(classifySchema(['items', 'item_values', 'users', 'projects'])).toBe('new');
  });
  it('classifies the pre-items schema by its statuses marker', () => {
    expect(classifySchema(['tickets', 'statuses', 'ticket_values', 'users'])).toBe('old');
  });
  it('classifies a database with neither marker as empty', () => {
    expect(classifySchema([])).toBe('empty');
    expect(classifySchema(['users', 'projects'])).toBe('empty');
  });
  it('prefers new when (defensively) both markers are present', () => {
    expect(classifySchema(['item_values', 'statuses'])).toBe('new');
  });
});
