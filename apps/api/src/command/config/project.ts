import * as v from 'valibot';
import { asc, eq } from 'drizzle-orm';
import { projects, schemes, type DbExecutor } from '@tickets/db';
import { HttpError } from '../../errors';
import { defineCommand } from '../registry';
import { projectCreated, projectUpdated } from './events';
import { defaultBranchInput, repositoryUrlInput } from './repository';

export const projectCreateInput = v.object({
  key: v.pipe(v.string(), v.minLength(1)),
  name: v.pipe(v.string(), v.minLength(1)),
  itemPrefix: v.pipe(v.string(), v.minLength(1)),
  // Left out by the web's New project dialog: the project then starts on the
  // shared scheme, as every project does until Settings forks its own.
  schemeId: v.optional(v.pipe(v.number(), v.integer())),
});

// The shared scheme: the seeded `software` one, else the oldest there is.
async function sharedSchemeId(tx: DbExecutor): Promise<number> {
  const rows = await tx.select({ id: schemes.id, key: schemes.key }).from(schemes).orderBy(asc(schemes.id));
  const scheme = rows.find((row) => row.key === 'software') ?? rows[0];
  if (!scheme) throw new HttpError(409, 'there is no scheme to create the project on');
  return scheme.id;
}

export const projectCreate = defineCommand({
  kind: 'project.create',
  input: projectCreateInput,
  aggregate: () => ({ type: 'project' }),
  async handler(tx, input, ctx) {
    const schemeId = input.schemeId ?? (await sharedSchemeId(tx));
    const inserted = await tx.insert(projects).values({ ...input, schemeId }).returning();
    const project = inserted[0]!;
    ctx.aggregateId = project.id;
    await ctx.emit(projectCreated, { key: project.key, name: project.name, itemPrefix: project.itemPrefix, schemeId: project.schemeId });
    return { id: project.id };
  },
});

export const projectUpdateInput = v.object({
  id: v.pipe(v.number(), v.integer()),
  schemeId: v.optional(v.pipe(v.number(), v.integer())),
  name: v.optional(v.pipe(v.string(), v.minLength(1))),
  // null or '' clears either. Clearing the repository clears its branch too.
  repositoryUrl: v.optional(repositoryUrlInput),
  defaultBranch: v.optional(defaultBranchInput),
});

export const projectUpdate = defineCommand({
  kind: 'project.update',
  input: projectUpdateInput,
  aggregate: (input) => ({ type: 'project', id: input.id }),
  async handler(tx, input, ctx) {
    const existing = (await tx.select().from(projects).where(eq(projects.id, input.id)))[0];
    if (!existing) throw new HttpError(404, 'project not found');
    const changes: Record<string, unknown> = {};
    const set: Record<string, unknown> = {};
    if (input.schemeId !== undefined) { set.schemeId = input.schemeId; changes.schemeId = input.schemeId; }
    if (input.name !== undefined) { set.name = input.name; changes.name = input.name; }
    const repositoryUrl = input.repositoryUrl === undefined ? existing.repositoryUrl : input.repositoryUrl || null;
    let defaultBranch = input.defaultBranch === undefined ? existing.defaultBranch : input.defaultBranch || null;
    if (repositoryUrl === null && input.defaultBranch === undefined) defaultBranch = null;
    if (repositoryUrl === null && defaultBranch !== null) {
      // Worded like an input issue (`path: message`), so the settings form
      // shows it at the branch field.
      throw new HttpError(400, 'invalid command input: defaultBranch: Give the repository\'s link first: a branch belongs to a repository.');
    }
    if (repositoryUrl !== existing.repositoryUrl) { set.repositoryUrl = repositoryUrl; changes.repositoryUrl = repositoryUrl; }
    if (defaultBranch !== existing.defaultBranch) { set.defaultBranch = defaultBranch; changes.defaultBranch = defaultBranch; }
    if (Object.keys(set).length > 0) await tx.update(projects).set(set).where(eq(projects.id, input.id));
    ctx.aggregateId = input.id;
    await ctx.emit(projectUpdated, { changes });
    return { id: input.id };
  },
});
