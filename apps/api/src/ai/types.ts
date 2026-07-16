// Shared AI-session types. E1 exercises the terminal path; the agent-only
// variants (prompt/message/permission frames, AgentRun) arrive in E2/E3 — the
// full unions live in docs/superpowers/specs/2026-07-14-ai-sessions-design.md.

export type SessionId = number;
export type SessionKind = 'terminal' | 'agent';

export type SessionStatus =
  | 'starting'
  | 'running'
  | 'live' // terminal is up and attached to a pty (E1)
  | 'idle' // agent finished a turn, awaiting a prompt (E2)
  | 'awaiting_input' // blocked on a permission decision (E3)
  | 'interrupted' // API restarted underneath it; may be resumable
  | 'disconnected' // orphaned by an API restart; reconciled on boot
  | 'exited'
  | 'failed';

// Frames the client sends over the socket. The transport carries the full union
// from the overview spec; E1 exercises attach/input/resize/interrupt (the
// terminal subset). `prompt`/`permission` are accepted by the type but ignored
// by the terminal handler until E2/E3 wire the agent path.
export type ClientFrame =
  | { type: 'attach'; lastSeq: number }
  | { type: 'input'; data: string } // terminal keystrokes
  | { type: 'resize'; cols: number; rows: number } // terminal
  | { type: 'prompt'; text: string } // agent (E2)
  | { type: 'permission'; requestId: string; result: 'allow' | 'deny'; reason?: string } // E3
  | { type: 'interrupt' };

// The normalized agent event union. EVERY provider maps its native output into
// this; the persistence layer and the UI only ever see AgentEvent and never
// learn which provider produced it. One row of ai_messages per event.
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
      usage?: {
        inputTokens: number;
        outputTokens: number;
        cacheReadTokens: number;
        cacheCreationTokens: number;
      };
    }
  | { type: 'error'; message: string };

// Frames the server pushes to an attached socket. Terminal sessions use
// `output`; agent sessions use `message` (a normalized AgentEvent). Both share
// `status`/`replay_done`/`notice`.
export type ServerFrame =
  | { type: 'output'; seq: number; data: string }
  | { type: 'message'; seq: number; event: AgentEvent }
  | { type: 'status'; status: SessionStatus; exitCode?: number | null }
  | { type: 'replay_done' }
  | { type: 'notice'; message: string }
  | { type: 'activity'; busy: boolean; command?: string; exitCode?: number; integrated?: boolean };

// A connected socket. The supervisor never holds the transport directly — it
// holds Subscribers, so it is testable with a plain object.
export interface Subscriber {
  send(frame: ServerFrame): void;
  close?(): void;
}

// ── Runner: WHERE a process runs. E1 = LocalRunner (node-pty). ────────────────

export interface PtySpec {
  cwd: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  cols: number;
  rows: number;
}

export interface PtyHandle {
  // Raw output chunks, in order, until the process closes.
  readonly output: AsyncIterable<string>;
  // Resolves when the process exits.
  readonly exit: Promise<{ exitCode: number | null }>;
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(): void;
}

export interface Runner {
  spawnPty(spec: PtySpec): PtyHandle;
}

// ── Store: persistence the supervisor needs. Real adapter is DB-backed; unit ──
// tests use an in-memory fake. Output is persisted BEFORE it is broadcast, so a
// client that has seen seq=N is always recoverable from the store alone.

export interface OutputChunk {
  seq: number;
  data: string;
}

// One persisted agent message: the seq (shared with the wire frame) and the
// normalized event. The store derives the ai_messages row columns from the
// event and reconstructs the event from the row on replay.
export interface PersistedMessage {
  seq: number;
  event: AgentEvent;
}

export interface SessionStore {
  // Persist a batch of already-sequenced chunks. Resolves once durable.
  appendOutput(sessionId: SessionId, chunks: OutputChunk[]): Promise<void>;
  // Chunks with seq > afterSeq (ascending) plus the oldest seq still stored, so
  // the supervisor can flag truncated scrollback on replay. oldestSeq is null
  // when nothing is stored.
  loadOutputSince(
    sessionId: SessionId,
    afterSeq: number,
  ): Promise<{ chunks: OutputChunk[]; oldestSeq: number | null }>;
  // Drop all but the newest `keep` chunks for a session.
  pruneOutput(sessionId: SessionId, keep: number): Promise<void>;
  // Agent analogue of appendOutput/loadOutputSince: one ai_messages row per
  // event, same seq/persist-before-broadcast discipline. oldestSeq lets replay
  // flag a truncated message history exactly like terminal scrollback.
  appendMessages(sessionId: SessionId, messages: PersistedMessage[]): Promise<void>;
  loadMessagesSince(
    sessionId: SessionId,
    afterSeq: number,
  ): Promise<{ messages: PersistedMessage[]; oldestSeq: number | null }>;
  // Surface accumulated spend on the session row (agent runs cost real money).
  setCost(sessionId: SessionId, costUsd: number): Promise<void>;
  // A pending ai_permission_requests row IS a parked canUseTool promise (TIX-209).
  // Returns the row id so the decision can be recorded against it.
  createPermissionRequest(
    sessionId: SessionId,
    toolName: string,
    input: unknown,
  ): Promise<number>;
  decidePermissionRequest(
    id: number,
    status: 'allowed' | 'denied',
    reason?: string,
    decidedBy?: number,
  ): Promise<void>;
  // Mark a session running (on start).
  markRunning(sessionId: SessionId): Promise<void>;
  // Non-terminal status transition (running↔idle↔awaiting_input) without setting
  // ended_at — used by agent turns. finishSession is still the terminal one.
  setStatus(sessionId: SessionId, status: SessionStatus): Promise<void>;
  // Terminal transition: status + exit code + ended_at (on process exit/failure).
  finishSession(
    sessionId: SessionId,
    status: SessionStatus,
    exitCode: number | null,
  ): Promise<void>;
  // Flip any session left running/live/idle/etc. with no ended_at to
  // 'disconnected' and stamp ended_at — called once at boot to clean up
  // sessions orphaned by an API restart. Returns the number of rows affected.
  reconcileOrphaned(): Promise<number>;
}
