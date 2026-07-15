// Shared AI-session types. E1 exercises the terminal path; the agent-only
// variants (prompt/message/permission frames, AgentRun) arrive in E2/E3 — the
// full unions live in docs/superpowers/specs/2026-07-14-ai-sessions-design.md.

export type SessionId = number;
export type SessionKind = 'terminal' | 'agent';

export type SessionStatus =
  | 'starting'
  | 'running'
  | 'idle' // agent finished a turn, awaiting a prompt (E2)
  | 'awaiting_input' // blocked on a permission decision (E3)
  | 'interrupted' // API restarted underneath it; may be resumable
  | 'exited'
  | 'failed';

// Frames the server pushes to an attached socket. E1 uses the terminal subset;
// `message` (AgentEvent) is added in E2.
export type ServerFrame =
  | { type: 'output'; seq: number; data: string }
  | { type: 'status'; status: SessionStatus; exitCode?: number | null }
  | { type: 'replay_done' }
  | { type: 'notice'; message: string };

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
  // Mark a session running (on start).
  markRunning(sessionId: SessionId): Promise<void>;
  // Terminal transition: status + exit code + ended_at (on process exit/failure).
  finishSession(
    sessionId: SessionId,
    status: SessionStatus,
    exitCode: number | null,
  ): Promise<void>;
}
