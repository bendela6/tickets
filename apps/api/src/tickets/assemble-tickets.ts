import { eq, inArray, or } from 'drizzle-orm';
import type { Db } from '@tickets/db';
import { comments, ticketLinks, ticketValues, tickets } from '@tickets/db';
import { renderValue } from './render-value';
import type { ProjectVocab } from '../vocab/load-project-vocab';

// Assembles the EAV rows into what the frontend consumes:
// { id, number, typeId, parentId, values: { fieldKey: primitive | array } }.
// multi_select fields collect into arrays; everything else is a single value.
export async function assembleTickets(db: Db, vocab: ProjectVocab) {
  const ticketRows = await db.select().from(tickets).where(eq(tickets.projectId, vocab.project.id));
  if (ticketRows.length === 0) {
    return [];
  }
  const ticketIds = ticketRows.map((row) => row.id);
  const [valueRows, commentRows, linkRows] = await Promise.all([
    db.select().from(ticketValues).where(inArray(ticketValues.ticketId, ticketIds)),
    db.select().from(comments).where(inArray(comments.ticketId, ticketIds)),
    db
      .select()
      .from(ticketLinks)
      .where(
        or(
          inArray(ticketLinks.sourceTicketId, ticketIds),
          inArray(ticketLinks.targetTicketId, ticketIds),
        ),
      ),
  ]);

  const valuesByTicket = new Map<number, Record<string, unknown>>();
  for (const row of valueRows) {
    const field = vocab.fieldById.get(row.fieldId);
    if (!field) {
      continue;
    }
    const bucket = valuesByTicket.get(row.ticketId) ?? {};
    const rendered = renderValue(vocab, row);
    if (field.type === 'multi_select') {
      const existing = (bucket[field.key] as unknown[] | undefined) ?? [];
      existing.push(rendered);
      bucket[field.key] = existing;
    } else {
      bucket[field.key] = rendered;
    }
    valuesByTicket.set(row.ticketId, bucket);
  }

  const commentsByTicket = new Map<number, (typeof commentRows)[number][]>();
  for (const row of commentRows) {
    const bucket = commentsByTicket.get(row.ticketId) ?? [];
    bucket.push(row);
    commentsByTicket.set(row.ticketId, bucket);
  }

  const linksByTicket = new Map<number, (typeof linkRows)[number][]>();
  for (const row of linkRows) {
    for (const ticketId of [row.sourceTicketId, row.targetTicketId]) {
      const bucket = linksByTicket.get(ticketId) ?? [];
      if (!bucket.includes(row)) {
        bucket.push(row);
      }
      linksByTicket.set(ticketId, bucket);
    }
  }

  return ticketRows.map((row) => {
    return {
      id: row.id,
      number: row.number,
      typeId: row.typeId,
      parentId: row.parentId,
      createdBy: row.createdBy,
      archivedAt: row.archivedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      values: valuesByTicket.get(row.id) ?? {},
      comments: commentsByTicket.get(row.id) ?? [],
      links: linksByTicket.get(row.id) ?? [],
    };
  });
}
