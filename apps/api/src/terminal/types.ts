// Terminal-only session types. No `kind` discriminator, no agent concepts
// (providers, messages, permissions, cost, dispatch) — a terminal session is
// always a PTY. terminal.session_status carries exactly these five values;
// there is no `running`/`idle`/`awaiting_input` here, those are agent facts.

export type SessionId = number;

export type SessionStatus = 'starting' | 'live' | 'disconnected' | 'exited' | 'failed';

// Frames the client sends over the socket.
export type ClientFrame =
  | { type: 'attach'; lastSeq: number }
  | { type: 'input'; data: string } // terminal keystrokes
  | { type: 'resize'; cols: number; rows: number }
  | { type: 'interrupt' }; // Ctrl-C to the foreground process

// Frames the server pushes to an attached socket.
export type ServerFrame =
  | { type: 'output'; seq: number; data: string }
  | { type: 'status'; status: SessionStatus; exitCode?: number | null }
  | { type: 'replay_done' }
  | { type: 'notice'; message: string }
  | { type: 'activity'; busy: boolean; command?: string; exitCode?: number; integrated?: boolean };

// A connected socket. The driver never holds the transport directly — it
// holds Subscribers, so it is testable with a plain object.
export interface Subscriber {
  send(frame: ServerFrame): void;
  close?(): void;
}

// ── Runner: WHERE a process runs (node-pty locally; a container runner could
// implement the same interface later without the driver changing). ─────────

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
