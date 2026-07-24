import { randomBytes } from 'node:crypto';
import { and, count, eq, gte, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import * as v from 'valibot';
import type { Db } from '../db/client';
import { apps, issues, signals, sourcemapArtifacts } from '../db/schema';
import { composeDsn } from '../dsn';
import { HttpError } from '../errors';
import { parseIntParam } from '../params';

const CreateAppSchema = v.object({
  name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(100)),
  upsert: v.optional(v.boolean()),
});

const RenameAppSchema = v.object({
  name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(100)),
});

function generateIngestKey(): string {
  return `pub_${randomBytes(6).toString('hex')}`;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function registerAppsRoutes(app: FastifyInstance, context: { db: Db }) {
  app.post('/apps', async (request, reply) => {
    const parsed = v.safeParse(CreateAppSchema, request.body ?? {});
    if (!parsed.success) throw new HttpError(400, 'name is required');
    const slug = slugify(parsed.output.name);
    if (!slug) throw new HttpError(400, 'name must contain letters or digits');
    const ingestKey = generateIngestKey();
    const inserted = await context.db
      .insert(apps)
      .values({ name: parsed.output.name, slug, ingestKey })
      .onConflictDoNothing({ target: apps.slug })
      .returning();
    if (inserted.length > 0) {
      const [row] = inserted;
      return reply.status(201).send({ ...row, dsn: composeDsn(row!.ingestKey, row!.id) });
    }
    // Lost the race (or a plain duplicate): fetch whichever row won.
    const [existingRow] = await context.db.select().from(apps).where(eq(apps.slug, slug));
    if (parsed.output.upsert) {
      return reply.status(200).send({ ...existingRow, dsn: composeDsn(existingRow!.ingestKey, existingRow!.id) });
    }
    throw new HttpError(409, `an app with slug "${slug}" already exists`);
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
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [counts] = await context.db
      .select({
        total: count(),
        errors: count(sql`CASE WHEN ${signals.kind} = 'error' THEN 1 END`),
      })
      .from(signals)
      .where(and(eq(signals.appId, id), gte(signals.receivedAt, since)));
    return {
      ...row,
      dsn: composeDsn(row.ingestKey, row.id),
      signals24h: counts?.total ?? 0,
      errors24h: counts?.errors ?? 0,
    };
  });

  app.patch('/apps/:id', async (request, reply) => {
    const id = parseIntParam((request.params as { id: string }).id);
    const parsed = v.safeParse(RenameAppSchema, request.body ?? {});
    if (!parsed.success) throw new HttpError(400, 'name is required');
    const [existing] = await context.db.select().from(apps).where(eq(apps.id, id));
    if (!existing) throw new HttpError(404, 'app not found');
    const slug = slugify(parsed.output.name);
    if (!slug) throw new HttpError(400, 'name must contain letters or digits');
    const [slugOwner] = await context.db.select().from(apps).where(eq(apps.slug, slug));
    if (slugOwner && slugOwner.id !== id) {
      throw new HttpError(409, `an app with slug "${slug}" already exists`);
    }
    const [updated] = await context.db
      .update(apps)
      .set({ name: parsed.output.name, slug })
      .where(eq(apps.id, id))
      .returning();
    return reply.status(200).send({
      id: updated!.id,
      name: updated!.name,
      slug: updated!.slug,
      createdAt: updated!.createdAt,
    });
  });

  app.post('/apps/:id/rotate', async (request, reply) => {
    const id = parseIntParam((request.params as { id: string }).id);
    const [existing] = await context.db.select().from(apps).where(eq(apps.id, id));
    if (!existing) throw new HttpError(404, 'app not found');
    const ingestKey = generateIngestKey();
    const [updated] = await context.db
      .update(apps)
      .set({ ingestKey })
      .where(eq(apps.id, id))
      .returning();
    return reply.status(200).send({ ...updated, dsn: composeDsn(updated!.ingestKey, updated!.id) });
  });

  // Hard-deletes an app and all of its data. No ON DELETE CASCADE exists on the
  // app_id FKs (schema.ts references are plain `.references()`, default NO ACTION),
  // so children are deleted explicitly, FK-safe order: signals (references issues
  // via issue_id) before issues, then sourcemap_artifacts, then the app row itself.
  // All in one transaction so a mid-way failure leaves the app intact.
  app.delete('/apps/:id', async (request) => {
    const id = parseIntParam((request.params as { id: string }).id);
    const [existing] = await context.db.select().from(apps).where(eq(apps.id, id));
    if (!existing) throw new HttpError(404, 'app not found');

    await context.db.transaction(async (tx) => {
      await tx.delete(signals).where(eq(signals.appId, id));
      await tx.delete(issues).where(eq(issues.appId, id));
      await tx.delete(sourcemapArtifacts).where(eq(sourcemapArtifacts.appId, id));
      await tx.delete(apps).where(eq(apps.id, id));
    });

    return { deleted: true };
  });

  app.get('/meta', async () => {
    const [row] = await context.db.execute<{ size: string }>(
      sql`SELECT pg_database_size(current_database()) AS size`,
    );
    return { dbSizeBytes: Number(row!.size) };
  });
}
