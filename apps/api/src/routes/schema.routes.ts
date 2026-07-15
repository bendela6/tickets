import type { FastifyInstance } from 'fastify';
import { describeSchema } from '@tickets/db';

// no db context needed; the schema graph is derived from the drizzle table
// objects, not the database.
export function registerSchemaRoutes(app: FastifyInstance) {
  app.get('/api/schema', async () => describeSchema());
}
