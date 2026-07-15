// Runs as a vitest setupFile — before any test file (and therefore before any
// `@tickets/db` import) is loaded. `@tickets/db`'s environment.ts reads
// process.env.POSTGRES_DATABASE at module-load time and uses
// `process.loadEnvFile` for the workspace `.env`, which does NOT override
// variables already present in process.env. Setting it here, this early,
// guarantees the api test suite always targets `tickets_test` regardless of
// whether the test command was itself prefixed with POSTGRES_DATABASE=tickets_test.
process.env.POSTGRES_DATABASE = 'tickets_test';
