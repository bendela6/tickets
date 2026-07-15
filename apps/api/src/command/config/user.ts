import * as v from 'valibot';
import { users } from '@tickets/db';
import { defineCommand } from '../registry';
import { userCreated } from './events';

export const userCreateInput = v.object({
  name: v.pipe(v.string(), v.minLength(1)),
  kind: v.picklist(['human', 'agent']),
  email: v.optional(v.nullable(v.string())),
});

export const userCreate = defineCommand({
  kind: 'user.create',
  input: userCreateInput,
  aggregate: () => ({ type: 'user' }),
  async handler(tx, input, ctx) {
    const inserted = await tx.insert(users).values({ name: input.name, kind: input.kind, email: input.email ?? null }).returning();
    const user = inserted[0]!;
    ctx.aggregateId = user.id;
    await ctx.emit(userCreated, { name: user.name, kind: user.kind });
    return { id: user.id };
  },
});
