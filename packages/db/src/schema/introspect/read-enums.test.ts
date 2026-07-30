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
});
