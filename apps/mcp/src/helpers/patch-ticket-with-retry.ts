import { ApiError, apiFetch } from '../api-client';
import type { ToolContext } from '../actor';
import { loadBoard } from './load-board';
import { resolveTicket } from './resolve-ticket';

// Owns the optimistic-lock plumbing: fetch the fresh updatedAt, PATCH, and on
// a 409 (someone moved the ticket between our read and write) retry exactly
// once with the newer timestamp.
export async function patchTicketWithRetry(
  context: ToolContext,
  projectKey: string,
  ticketNumber: number,
  body: Record<string, unknown>,
): Promise<{ id: number; updatedAt: string }> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const board = await loadBoard(projectKey);
    const ticket = resolveTicket(board, ticketNumber);
    try {
      return await apiFetch<{ id: number; updatedAt: string }>(`/api/tickets/${ticket.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...body,
          actorId: context.actorId,
          expectedUpdatedAt: ticket.updatedAt,
        }),
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409 && attempt === 0) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }
  throw lastError ?? new Error('patch failed');
}
