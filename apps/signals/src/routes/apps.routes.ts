import { randomBytes } from 'node:crypto';
import { count, eq, gte, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import * as v from 'valibot';
import type { Db } from '../db/client';
import { apps, signals } from '../db/schema';
import { composeDsn } from '../dsn';
import { HttpError } from '../errors';
import { parseIntParam } from '../params';

const CreateAppSchema = v.object({
  name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(100)),
  upsert: v.optional(v.boolean()),
});

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function registerAppsRoutes(app: FastifyInstance, context: { db: Db }) {
  app.post('/apps', async (request, reply) => {
    const parsed = v.safeParse(CreateAppSchema, request.body ?? {});
    if (!parsed.success) throw new HttpError(400, 'name is required');
    const slug = slugify(parsed.output.name);
    if (!slug) throw new HttpError(400, 'name must contain letters or digits');
    const existing = await context.db.select().from(apps).where(eq(apps.slug, slug));
    if (existing.length > 0) {
      if (parsed.output.upsert) {
        const [existingRow] = existing;
        return reply.status(200).send({ ...existingRow, dsn: composeDsn(existingRow!.ingestKey, existingRow!.id) });
      }
      throw new HttpError(409, `an app with slug "${slug}" already exists`);
    }
    const ingestKey = `pub_${randomBytes(6).toString('hex')}`;
    const [row] = await context.db.insert(apps).values({ name: parsed.output.name, slug, ingestKey }).returning();
    reply.status(201).send({ ...row, dsn: composeDsn(row!.ingestKey, row!.id) });
  });

  app.get('/apps', async () => {
    const rows = await context.db.select().from(apps).orderBy(apps.id);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const counts = await context.db
      .select({
        appId: signals.appId,
        total: count(),
        errors: count(sql`CASE WHEN ${signals.kind} = 'error' THEN 1 END`),
      })
      .from(signals)
      .where(gte(signals.receivedAt, since))
      .groupBy(signals.appId);
    const byApp = new Map(counts.map((c) => [c.appId, c]));
    return rows.map((r) => ({
      id: r.id, name: r.name, slug: r.slug, createdAt: r.createdAt,
      signals24h: byApp.get(r.id)?.total ?? 0,
      errors24h: byApp.get(r.id)?.errors ?? 0,
    }));
  });

  app.get('/apps/:id', async (request) => {
    const id = parseIntParam((request.params as { id: string }).id);
    const [row] = await context.db.select().from(apps).where(eq(apps.id, id));
    if (!row) throw new HttpError(404, 'app not found');
    return { ...row, dsn: composeDsn(row.ingestKey, row.id) };
  });

  app.get('/meta', async () => {
    const [row] = await context.db.execute<{ size: string }>(
      sql`SELECT pg_database_size(current_database()) AS size`,
    );
    return { dbSizeBytes: Number(row!.size) };
  });
}
