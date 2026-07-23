import type { Db } from '@tickets/db';
import { itemActivity } from '@tickets/db';
import { docToText, parseDoc } from '@tickets/richtext';
import type { StoredEvent } from '../automation/registry';

// Compute a self-contained, display-ready summary from a value-only item event.
function summarize(event: StoredEvent): Record<string, unknown> {
  const payload = (event.payload ?? {}) as Record<string, unknown>;
  if (event.kind === 'comment.added') {
    const body = typeof payload.body === 'string' ? payload.body : '';
    // Comment bodies may be legacy markdown or a serialized tiptap doc — an
    // un-parsed doc's raw JSON is not a usable excerpt, so extract plain
    // text first.
    const doc = parseDoc(body);
    const text = doc ? docToText(doc) : body;
    return { commentId: payload.commentId, excerpt: text.slice(0, 140) };
  }
  if (event.kind === 'item.created') {
    const values = (payload.values ?? {}) as Record<string, unknown>;
    return { typeKey: payload.typeKey, number: payload.number, title: values.title ?? null };
  }
  // field_changed / reparented / archived / restored / linked / unlinked: the
  // payload is already the rendered diff, so store it verbatim.
  return payload;
}

export async function projectEvent(db: Db, event: StoredEvent): Promise<void> {
  if (event.aggregateType !== 'item' || event.version < 1 || event.projectId === null) return;
  await db
    .insert(itemActivity)
    .values({
      itemId: event.aggregateId,
      eventId: event.id,
      projectId: event.projectId,
      kind: event.kind,
      actorId: event.actorId,
      at: event.at,
      correlationId: event.correlationId,
      summary: summarize(event),
    })
    .onConflictDoNothing({ target: itemActivity.eventId });
}
