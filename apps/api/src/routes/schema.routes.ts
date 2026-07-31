import type { FastifyInstance } from 'fastify';
import { environment, introspectDatabase, listDatabases, UnknownDatabaseError } from '@tickets/db';

// The schema graph is read from the LIVE database's catalog, not from the
// drizzle table objects — the screen's whole purpose is showing what is
// actually deployed, which the code-derived graph cannot report (it is
// identical for every database, and cannot see a pending migration).
// describeSchema() still exists for the SSOT conformance test in packages/db.
//
// No db context is used: introspection opens its own short-lived connection to
// the named database, which is by definition not the one the request handle is
// bound to.
export function registerSchemaRoutes(app: FastifyInstance) {
  app.get('/api/schema/databases', async () => ({
    databases: await listDatabases(),
    current: environment.postgres.database,
  }));

  app.get('/api/schema', async (request, reply) => {
    const requested = (request.query as { database?: string }).database;
    const name = requested && requested.length > 0 ? requested : environment.postgres.database;
    try {
      return await introspectDatabase(name);
    } catch (err) {
      // An unknown name is a client error, not a fault: it never reached a
      // connection. Anything else is a real failure and belongs to the
      // framework's error handler.
      if (err instanceof UnknownDatabaseError) {
        return reply.code(400).send({ error: `unknown database "${err.database}"` });
      }
      throw err;
    }
  });
}
