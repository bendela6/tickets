import * as v from 'valibot';
import { eq, sql } from 'drizzle-orm';
import type { DbExecutor } from '@tickets/db';
import { comments, items } from '@tickets/db';
import { HttpError } from '../../errors';
import { defineCommand } from '../registry';
import { commentAdded, commentDeleted } from './events';

export const QUOTE_MAX_LENGTH = 1000;

// The fragment of the item's description a thread is on, as it was selected:
// runs of whitespace (line breaks included) collapse to one space, so the same
// fragment reads the same however it was selected.
const quoteInput = v.pipe(
  v.string(),
  v.transform((text) => text.replace(/\s+/g, ' ').trim()),
  v.minLength(1, 'the quote is empty'),
  v.maxLength(QUOTE_MAX_LENGTH, `the quote is longer than ${QUOTE_MAX_LENGTH} characters`),
);

export const itemCommentInput = v.object({
  itemId: v.pipe(v.number(), v.integer()),
  body: v.pipe(v.string(), v.minLength(1)),
  parentId: v.optional(v.nullable(v.pipe(v.number(), v.integer()))),
  // On a comment that starts a thread only: a reply is on its thread's fragment.
  quote: v.optional(v.nullable(quoteInput)),
  // Which place of the quote, from 0, when the description has it more than once.
  nth: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0)))),
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
    const place = await placeOf(tx, input);
    const inserted = await tx
      .insert(comments)
      .values({
        itemId: input.itemId,
        authorId: ctx.envelope.actorId,
        parentId: input.parentId ?? null,
        body: input.body,
        quote: place.quote,
        nth: place.nth,
      })
      .returning();
    const comment = inserted[0]!;
    await ctx.emit(commentAdded, { commentId: comment.id, body: input.body });
    return { id: comment.id };
  },
});

export const commentDeleteInput = v.object({ id: v.pipe(v.number(), v.integer()) });

// Its author deletes it: it is marked deleted and leaves every list and read.
// Its comment.added event stays in the item's activity, and so do the replies
// under it (they keep their parentId and, on a fragment, their quote).
export const commentDelete = defineCommand({
  kind: 'comment.delete',
  input: commentDeleteInput,
  aggregate: () => ({ type: 'item' }),
  async handler(tx, input, ctx) {
    const rows = await tx.select().from(comments).where(eq(comments.id, input.id));
    const comment = rows[0];
    if (!comment || comment.deletedAt !== null) throw new HttpError(404, 'comment not found');
    if (comment.authorId !== ctx.envelope.actorId) {
      throw new HttpError(403, 'only its author can delete a comment');
    }
    const item = (await tx.select().from(items).where(eq(items.id, comment.itemId)))[0]!;
    ctx.aggregateId = comment.itemId;
    ctx.projectId = item.projectId;
    await tx.update(comments).set({ deletedAt: sql`now()` }).where(eq(comments.id, comment.id));
    await ctx.emit(commentDeleted, { commentId: comment.id });
    return { id: comment.id };
  },
});

// Where the comment sits: a thread's first comment names its fragment (or none,
// for the item as a whole); a reply takes its thread's, and can't name its own.
async function placeOf(
  tx: DbExecutor,
  input: v.InferOutput<typeof itemCommentInput>,
): Promise<{ quote: string | null; nth: number | null }> {
  const quote = input.quote ?? null;
  const nth = input.nth ?? null;
  if (input.parentId != null) {
    if (quote !== null || nth !== null) {
      throw new HttpError(422, "a reply is on its thread's quote and can't set its own");
    }
    const parent = await replyParent(tx, input.itemId, input.parentId);
    return { quote: parent.quote, nth: parent.nth };
  }
  if (quote === null) {
    if (nth !== null) throw new HttpError(422, 'nth is the place of a quote: send a quote with it');
    return { quote: null, nth: null };
  }
  return { quote, nth: nth ?? 0 };
}

// A reply goes under a live comment on the same item: any row of records.comments,
// whatever its kind, so a question (a comment too, TK-81.1) passes the same check.
// A deleted comment keeps the replies it has but takes no more.
async function replyParent(tx: DbExecutor, itemId: number, parentId: number) {
  const parentRows = await tx.select().from(comments).where(eq(comments.id, parentId));
  const parent = parentRows[0];
  if (!parent || parent.deletedAt !== null) throw new HttpError(404, 'parent comment not found');
  if (parent.itemId !== itemId) throw new HttpError(422, 'the parent comment is on another item');
  return parent;
}
