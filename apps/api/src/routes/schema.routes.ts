import type { FastifyInstance } from 'fastify';
import type { Db } from '@tickets/db';
import { describeSchema } from '@tickets/db';

// context kept for signature consistency with the other route modules; the
// schema graph is derived from the drizzle table objects, not the database.
export function registerSchemaRoutes(app: FastifyInstance, _context: { db: Db }) {
  app.get('/api/schema', async () => describeSchema());
}
