// Runs once, in vitest's main process, before any test file. Brings tickets_test up to
// the latest migration, so neither a fresh clone nor a new migration needs a manual
// step. The env is set before the import because @tickets/db reads it at load.
export default async function setup(): Promise<void> {
  process.env.POSTGRES_DATABASE = 'tickets_test';
  const { migrateDatabase } = await import('@tickets/db');
  await migrateDatabase();
}
