// packages/db/src/import/guard-not-production.ts
// The importer (and its verifier) are destructive/exploratory tools meant to
// run only against tickets_dev — but environment.ts defaults
// POSTGRES_DATABASE to 'tickets', the LIVE PRODUCTION database, and
// findEnvFile() only walks up 5 directory levels looking for .env. A missing
// or unreachable .env therefore silently points db:import / db:verify-import
// at the 635 real items the user works in daily. This has already happened
// once in this worktree.
//
// Refuse outright rather than trusting every caller to have its environment
// set up correctly. Both CLI entry points call this before touching the
// network, and importLegacy() calls it again (defense in depth) so a caller
// that builds a Db by hand and invokes importLegacy directly can't bypass it
// either. Every Db in this codebase is opened against `connectionUrl`, which
// is derived from `environment.postgres.database` at module load — so that
// single value is an accurate proxy for "which database is this process
// about to talk to," everywhere.
import { environment } from '../environment';

const PRODUCTION_DATABASE = 'tickets';

export function assertNotProductionDatabase(databaseName: string = environment.postgres.database): void {
  if (databaseName === PRODUCTION_DATABASE) {
    throw new Error(
      `Refusing to run: POSTGRES_DATABASE is "${PRODUCTION_DATABASE}" — the LIVE PRODUCTION ` +
        'database (the 635 real items the user works in daily). The importer and verifier only ' +
        'ever operate on tickets_dev. If tickets_dev is what you meant, this almost certainly means ' +
        '.env was not found (findEnvFile only walks up 5 directory levels) — set POSTGRES_DATABASE ' +
        'explicitly or run from a directory closer to the workspace root.',
    );
  }
}
