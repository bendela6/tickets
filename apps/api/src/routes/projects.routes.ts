import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import * as v from 'valibot';
import { eq, inArray } from 'drizzle-orm';
import type { Db } from '@tickets/db';
import { ensureSoftwareScheme, projects, seedProject, ticketEvents, tickets, users } from '@tickets/db';
import { assembleTickets } from '../tickets/assemble-tickets';
import { parseBody } from '../utils/parse-body';
import { loadProjectVocab } from '../vocab/load-project-vocab';

const createProjectSchema = v.object({
  //
  key: v.pipe(v.string(), v.minLength(1)),
  name: v.pipe(v.string(), v.minLength(1)),
  ticketPrefix: v.pipe(v.string(), v.minLength(1)),
});

function boardPayload(db: Db) {
  return async (projectKey: string) => {
    const vocab = await loadProjectVocab(db, { key: projectKey });
    const [assembled, userRows] = await Promise.all([
      assembleTickets(db, vocab),
      db.select().from(users),
    ]);
    return {
      project: vocab.project,
      users: userRows,
      types: vocab.types,
      typeFields: vocab.typeFields,
      statuses: vocab.statuses,
      transitions: vocab.transitions,
      fields: vocab.fields.map((field) => {
        return { ...field, options: vocab.optionsByFieldId.get(field.id) ?? [] };
      }),
      linkTypes: vocab.linkTypes,
      views: vocab.views,
      tickets: assembled,
    };
  };
}

export function registerProjectsRoutes(app: FastifyInstance, context: { db: Db }) {
  const { db } = context;
  const buildBoard = boardPayload(db);

  const listProjects = async (_request: FastifyRequest, reply: FastifyReply) => {
    const rows = await db.select().from(projects);
    reply.send({
      data: rows,
      meta: { skip: 0, take: rows.length, total: rows.length, sort: null },
    });
  };

  const createProject = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = parseBody(createProjectSchema, request.body);
    const { schemeId } = await ensureSoftwareScheme(db);
    const seeded = await seedProject(db, { ...body, schemeId });
    reply.status(201).send(seeded.project);
  };

  const getBoard = async (request: FastifyRequest, reply: FastifyReply) => {
    const { key } = request.params as { key: string };
    reply.send(await buildBoard(key));
  };

  const exportProject = async (request: FastifyRequest, reply: FastifyReply) => {
    const { key } = request.params as { key: string };
    const board = await buildBoard(key);
    const ticketIds = board.tickets.map((ticket) => ticket.id);
    const events =
      ticketIds.length > 0
        ? await db.select().from(ticketEvents).where(inArray(ticketEvents.ticketId, ticketIds))
        : [];
    reply.send({ exportedAt: new Date().toISOString(), ...board, events });
  };

  app.get('/api/projects', listProjects);
  app.post('/api/projects', createProject);
  app.get('/api/projects/:key/board', getBoard);
  app.get('/api/projects/:key/export', exportProject);
}
