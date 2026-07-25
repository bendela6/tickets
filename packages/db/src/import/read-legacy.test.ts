import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createLegacyClient } from './legacy-client';
import { readLegacy, type Legacy } from './read-legacy';

describe('readLegacy (requires tickets_legacy — see legacy-client.ts to restore it)', () => {
  let close: () => Promise<void>;
  let legacy: Legacy;

  beforeAll(async () => {
    const { sql } = createLegacyClient();
    close = () => sql.end();
    legacy = await readLegacy(sql);
  });
  afterAll(async () => { await close(); });

  it('reads the live counts', () => {
    expect(legacy.projects).toHaveLength(5);
    expect(legacy.tickets).toHaveLength(635);
    expect(legacy.ticketValues).toHaveLength(2948);
    expect(legacy.comments).toHaveLength(139);
    expect(legacy.ticketLinks).toHaveLength(191);
    expect(legacy.ticketEvents).toHaveLength(1523);
    expect(legacy.fields).toHaveLength(46);
    expect(legacy.statuses).toHaveLength(34);
    expect(legacy.ticketTypes).toHaveLength(5);
  });

  it('carries the type-owned field shape', () => {
    const title = legacy.fields.find((f) => f.key === 'title')!;
    expect(title.ticketTypeId).toBeGreaterThan(0);
    expect(title.type).toBe('text');
    expect(typeof title.position).toBe('number');
  });

  it('carries status kinds', () => {
    expect(legacy.statuses.every((s) => s.kind !== null)).toBe(true);
  });

  // postgres.js parses timestamptz/timestamp (oids 1184/1114) into a JS Date
  // by default, which only holds millisecond precision — Postgres stores
  // microseconds. legacy-client.ts overrides both oids so the raw wire
  // string comes back untouched. If that override regresses, these values
  // become `Date` instances again and the Legacy* `string` types go back to
  // being a lie.
  it('returns timestamps as raw strings, not parsed Date objects', () => {
    expect(typeof legacy.comments[0]!.createdAt).toBe('string');
    expect(typeof legacy.tickets[0]!.createdAt).toBe('string');
  });

  it('preserves sub-millisecond precision on timestamps (proves Date was never in the loop)', () => {
    // A `Date`-round-tripped value maxes out at 3 fractional digits
    // (`.197`); the raw wire string carries Postgres's full 6
    // (`.197523`). Every one of the 139 legacy comments has this shape.
    const microsecondPrecision = /\.\d{4,6}[+-]\d{2}(:\d{2})?$/;
    expect(legacy.comments.every((c) => microsecondPrecision.test(c.createdAt))).toBe(true);
  });
});
