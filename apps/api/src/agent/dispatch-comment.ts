import type { SessionStatus } from './types';

// The comment a dispatched agent posts back to its item on completion. Pure, so
// the wording is unit-tested; the orchestration just supplies the final session
// state. `costUsd` is the numeric string drizzle returns (or null).
export function dispatchComment(
  agentName: string,
  status: SessionStatus,
  costUsd: string | null,
  sessionId: number,
): string {
  const cost = costUsd != null ? ` · spend $${Number(costUsd).toFixed(2)}` : '';
  const link = ` (session #${sessionId})`;
  if (status === 'failed') {
    return `🤖 ${agentName}'s dispatched run failed${cost}.${link}`;
  }
  if (status === 'interrupted') {
    return `🤖 ${agentName}'s dispatched run was interrupted${cost}.${link}`;
  }
  return `🤖 ${agentName} finished the dispatched run — ${status}${cost}.${link}`;
}
