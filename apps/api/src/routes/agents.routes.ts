import type { FastifyInstance } from 'fastify';
import type { Db } from '@tickets/db';
import { agentWordInput, listReports, saveReport } from '../agents/reports';
import { parseBody } from '../utils/parse-body';

// What the agents working on the plans say they are doing (apps/api/src/agents).
// These write core.agent_reports directly, never through a command: a word
// every 20 seconds would fill the history with nothing.
export function registerAgentsRoutes(app: FastifyInstance, ctx: { db: Db }) {
  const { db } = ctx;

  // An agent's word: {name, state, role?, item?, text?}. Answers its report,
  // or null when the state is `clear`.
  app.post('/api/agents', async (request, reply) => {
    const word = parseBody(agentWordInput, request.body);
    reply.send({ data: await saveReport(db, word, new Date()) });
  });

  app.get('/api/agents', async (_request, reply) => {
    reply.send({ data: await listReports(db, new Date()) });
  });
}
