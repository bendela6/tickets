// packages/db/src/import/legacy-client.ts
// Raw postgres client for the pre-rebuild schema. No drizzle — those tables no
// longer exist in code. Restore the backup into tickets_legacy first.
import postgres, { type Sql } from 'postgres';
import { environment } from '../environment';

export const LEGACY_DATABASE = process.env.LEGACY_DATABASE ?? 'tickets_legacy';

export function createLegacyClient(): { sql: Sql } {
  const { host, port, user, password } = environment.postgres;
  return {
    sql: postgres(`postgres://${user}:${password}@${host}:${port}/${LEGACY_DATABASE}`, { max: 1 }),
  };
}
