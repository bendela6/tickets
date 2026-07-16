import { useAiSession } from '../../api/use-ai-session';
import { AgentSessionScreen } from './agent-session-screen';
import { AiSessionScreen } from './ai-session-screen';

// Dispatches /ai/:id to the terminal or agent screen by session kind. Both need
// the session row anyway; React Query dedupes the fetch across them.
export function SessionScreen({ sessionId }: { sessionId: number }) {
  const session = useAiSession(sessionId);
  if (session.data?.kind === 'agent') {
    return <AgentSessionScreen sessionId={sessionId} />;
  }
  return <AiSessionScreen sessionId={sessionId} />;
}
