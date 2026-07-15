import * as v from 'valibot';
import { count, eq } from 'drizzle-orm';
import { projects, views } from '@tickets/db';
import { HttpError } from '../../errors';
import { defineCommand } from '../registry';
import { viewCreated, viewUpdated } from './events';

export const viewCreateInput = v.object({
  projectKey: v.pipe(v.string(), v.minLength(1)),
  name: v.pipe(v.string(), v.minLength(1)),
  config: v.optional(v.record(v.string(), v.unknown())),
});

export const viewCreate = defineCommand({
  kind: 'view.create',
  input: viewCreateInput,
  aggregate: () => ({ type: 'view' }),
  async handler(tx, input, ctx) {
    const project = (await tx.select().from(projects).where(eq(projects.key, input.projectKey)))[0];
    if (!project) throw new HttpError(404, `unknown project "${input.projectKey}"`);
    const position = Number((await tx.select({ n: count() }).from(views).where(eq(views.projectId, project.id)))[0]?.n ?? 0);
    const inserted = await tx.insert(views).values({ projectId: project.id, name: input.name, position, config: input.config ?? {} }).returning();
    const view = inserted[0]!;
    ctx.aggregateId = view.id;
    await ctx.emit(viewCreated, { projectId: project.id, name: view.name });
    return { id: view.id };
  },
});

export const viewUpdateInput = v.object({
  id: v.pipe(v.number(), v.integer()),
  name: v.optional(v.string()),
  config: v.optional(v.record(v.string(), v.unknown())),
});

export const viewUpdate = defineCommand({
  kind: 'view.update',
  input: viewUpdateInput,
  aggregate: (input) => ({ type: 'view', id: input.id }),
  async handler(tx, input, ctx) {
    const set: Record<string, unknown> = {};
    const changes: Record<string, unknown> = {};
    if (input.name !== undefined) { set.name = input.name; changes.name = input.name; }
    if (input.config !== undefined) { set.config = input.config; changes.config = input.config; }
    if (Object.keys(set).length === 0) throw new HttpError(400, 'no view changes supplied');
    const updated = await tx.update(views).set(set).where(eq(views.id, input.id)).returning();
    if (!updated[0]) throw new HttpError(404, 'view not found');
    await ctx.emit(viewUpdated, { changes });
    return { id: input.id };
  },
});
