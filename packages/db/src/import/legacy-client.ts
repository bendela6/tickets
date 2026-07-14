// packages/db/src/import/legacy-client.ts
// Raw postgres client for the pre-rebuild schema. No drizzle — those tables no
// longer exist in code. Restore the backup into tickets_legacy first.
import postgres, { type Sql } from 'postgres';
import { environment } from '../environment';

export const LEGACY_DATABASE = process.env.LEGACY_DATABASE ?? 'tickets_legacy';

// postgres.js's default `timestamp`/`timestamptz` handler (oids 1114/1184)
// parses into a JS `Date`, which only holds millisecond precision. Postgres
// `timestamptz` stores microseconds, so that truncation happens at parse
// time — before any of our code runs — and no later `toISOString()` coercion
// can recover the lost digits. Override both oids to hand back the raw wire
// string untouched, so read-legacy.ts's `string` timestamp types are
// actually true and every consumer sees full precision.
const rawString = {
  to: 25, // text oid; these overrides are read-only reads, serialize is unused but required by the type
  serialize: (x: unknown) => String(x),
  parse: (x: string) => x,
};

export function createLegacyClient(): { sql: Sql } {
  const { host, port, user, password } = environment.postgres;
  return {
    sql: postgres(`postgres://${user}:${password}@${host}:${port}/${LEGACY_DATABASE}`, {
      max: 1,
      types: {
        timestamptz: { ...rawString, from: [1184] },
        timestamp: { ...rawString, from: [1114] },
      },
    }),
  };
}
