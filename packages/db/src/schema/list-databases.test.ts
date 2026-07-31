import { describe, expect, it } from 'vitest';
import { assertKnownDatabase, listDatabases, UnknownDatabaseError } from './list-databases';

describe('listDatabases', () => {
  it('includes the test database and excludes templates', async () => {
    const names = await listDatabases();
    expect(names).toContain('tickets_test');
    expect(names).not.toContain('template0');
    expect(names).not.toContain('template1');
  });

  it('is sorted', async () => {
    const names = await listDatabases();
    expect([...names].sort()).toEqual(names);
  });
});

describe('assertKnownDatabase', () => {
  it('returns a known name unchanged', async () => {
    await expect(assertKnownDatabase('tickets_test')).resolves.toBe('tickets_test');
  });

  it('rejects an unknown name', async () => {
    await expect(assertKnownDatabase('no_such_db')).rejects.toBeInstanceOf(UnknownDatabaseError);
  });

  it('rejects an injection attempt rather than connecting', async () => {
    await expect(assertKnownDatabase('tickets_test?host=evil')).rejects.toBeInstanceOf(
      UnknownDatabaseError,
    );
  });
});
