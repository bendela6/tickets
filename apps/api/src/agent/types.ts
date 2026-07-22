// Agent-only session types. No `kind` discriminator, no terminal/PTY concepts
// (a PTY, shell integration, terminal output) — an agent session is always a
// normalized AgentEvent stream. agent.session_status carries exactly these
// seven values; there is no `live`/`disconnected` here, those are terminal
// facts (see apps/api/src/terminal/types.ts).

export type SessionId = number;

export type SessionStatus =
  | 'starting'
  | 'running'
  | 'idle' // finished a turn, awaiting a prompt
  | 'awaiting_input' // blocked on a permission decision
  | 'interrupted' // API restarted underneath it; may be resumable
  | 'exited'
  | 'failed';

// The normalized agent event union. EVERY provider maps its native output into
// this; the persistence layer and the UI only ever see AgentEvent and never
// learn which provider produced it. One row of agent.messages per event.
export type AgentEvent =
  | { type: 'session_started'; providerSessionId: string }
  | { type: 'assistant_text'; text: string; parentToolUseId?: string }
  | { type: 'thinking'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown; parentToolUseId?: string }
  | { type: 'tool_result'; toolUseId: string; content: unknown; isError: boolean }
  | { type: 'permission_request'; id: string; toolName: string; input: unknown }
  | {
      type: 'result';
      costUsd: number;
      durationMs: number;
      isError: boolean;
      subtype?: string;
      usage?: {
        inputTokens: number;
        outputTokens: number;
        cacheReadTokens: number;
        cacheCreationTokens: number;
      };
    }
  | { type: 'error'; message: string };

// Frames the client sends over the socket. No `input`/`resize` — those are
// terminal-only (keystrokes/cols/rows into a PTY).
export type ClientFrame =
  | { type: 'attach'; lastSeq: number }
  | { type: 'prompt'; text: string } // start a follow-up turn
  | { type: 'permission'; requestId: string; result: 'allow' | 'deny'; reason?: string }
  | { type: 'interrupt' }; // run.interrupt(), not a process kill

// Frames the server pushes to an attached socket. No `output`/`activity` —
// those are terminal-only.
export type ServerFrame =
  | { type: 'message'; seq: number; event: AgentEvent }
  | { type: 'status'; status: SessionStatus }
  | { type: 'replay_done' }
  | { type: 'notice'; message: string };

// A connected socket. The driver never holds the transport directly — it
// holds Subscribers, so it is testable with a plain object.
export interface Subscriber {
  send(frame: ServerFrame): void;
  close?(): void;
}
