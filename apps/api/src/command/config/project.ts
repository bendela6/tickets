import * as v from 'valibot';
import { projects } from '@tickets/db';
import { defineCommand } from '../registry';
import { projectCreated } from './events';

export const projectCreateInput = v.object({
  key: v.pipe(v.string(), v.minLength(1)),
  name: v.pipe(v.string(), v.minLength(1)),
  itemPrefix: v.pipe(v.string(), v.minLength(1)),
  schemeId: v.pipe(v.number(), v.integer()),
});

export const projectCreate = defineCommand({
  kind: 'project.create',
  input: projectCreateInput,
  aggregate: () => ({ type: 'project' }),
  async handler(tx, input, ctx) {
    const inserted = await tx.insert(projects).values(input).returning();
    const project = inserted[0]!;
    ctx.aggregateId = project.id;
    await ctx.emit(projectCreated, { key: project.key, name: project.name, itemPrefix: project.itemPrefix, schemeId: project.schemeId });
    return { id: project.id };
  },
});
