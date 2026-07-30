import { describe, expect, it } from 'vitest';
import { withDatabase } from './connect';
import { readEnums } from './read-enums';

describe('readEnums', () => {
  it('reads enum declarations with ordered values', async () => {
    const enums = await withDatabase('tickets_test', (sql) => readEnums(sql));
    expect(enums.length).toBeGreaterThan(0);
    for (const e of enums) {
      expect(e.name.length).toBeGreaterThan(0);
      expect(e.values.length).toBeGreaterThan(0);
    }
  });

  it('keeps same-named enums in different schemas distinct', async () => {
    // agent.session_status and terminal.session_status both exist and print
    // the same bare name — collapsing them would lose one entirely.
    const enums = await withDatabase('tickets_test', (sql) => readEnums(sql));
    const sessionStatus = enums.filter((e) => e.name === 'session_status');
    expect(sessionStatus.length).toBe(2);
    expect(new Set(sessionStatus.map((e) => e.schema))).toEqual(new Set(['agent', 'terminal']));
  });

  it('carries the real namespace, never the string "public"', async () => {
    const enums = await withDatabase('tickets_test', (sql) => readEnums(sql));
    expect(enums.find((e) => e.name === 'field_type')!.schema).toBe('structure');
    for (const e of enums) expect(e.schema).not.toBe('public');
  });

  it('keeps enum values in declaration order, not alphabetical', async () => {
    // structure.status_kind's declared order (todo, active, blocked, done,
    // dropped) is a status ladder — its meaning. Alphabetical order would be
    // (active, blocked, done, dropped, todo): every element moves, so an
    // `ORDER BY enumlabel` regression can't hide behind a partial match.
    const enums = await withDatabase('tickets_test', (sql) => readEnums(sql));
    const statusKind = enums.find((e) => e.name === 'status_kind' && e.schema === 'structure');
    expect(statusKind?.values).toEqual(['todo', 'active', 'blocked', 'done', 'dropped']);
  });
});
