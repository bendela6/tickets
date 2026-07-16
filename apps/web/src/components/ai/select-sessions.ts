import type { AiSession } from '../../api/types';

export function terminalsOf(sessions: AiSession[]): AiSession[] {
  return sessions.filter((s) => s.kind === 'terminal');
}

export function agentsOf(sessions: AiSession[]): AiSession[] {
  return sessions.filter((s) => s.kind === 'agent');
}
