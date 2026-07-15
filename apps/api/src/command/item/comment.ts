import * as v from 'valibot';
import { eq } from 'drizzle-orm';
import { comments, items } from '@tickets/db';
import { HttpError } from '../../errors';
import { defineCommand } from '../registry';
import { commentAdded } from './events';

export const itemCommentInput = v.object({
  itemId: v.pipe(v.number(), v.integer()),
  body: v.pipe(v.string(), v.minLength(1)),
  parentId: v.optional(v.nullable(v.pipe(v.number(), v.integer()))),
});

export const itemComment = defineCommand({
  kind: 'item.comment',
  input: itemCommentInput,
  aggregate: (input) => ({ type: 'item', id: input.itemId }),
  async handler(tx, input, ctx) {
    const itemRows = await tx.select().from(items).where(eq(items.id, input.itemId));
    const item = itemRows[0];
    if (!item) throw new HttpError(404, 'item not found');
    ctx.projectId = item.projectId;
    const inserted = await tx
      .insert(comments)
      .values({ itemId: input.itemId, authorId: ctx.envelope.actorId, parentId: input.parentId ?? null, body: input.body })
      .returning();
    const comment = inserted[0]!;
    await ctx.emit(commentAdded, { commentId: comment.id, body: input.body });
    return { id: comment.id };
  },
});
