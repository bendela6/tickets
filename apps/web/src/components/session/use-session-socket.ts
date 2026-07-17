import { useEffect, useRef, useState } from 'react';
import type { AgentEvent, AgentSessionStatus, TerminalStatus } from '../../api/types';

// Shared between terminal and agent sessions (screen 10). Terminal and agent
// sessions live under different REST/WS paths now that there is no `kind`
// discriminator — the caller passes `basePath` ('/api/terminal/sessions' or
// '/api/agent/sessions') instead of the hook branching on kind. Generic over
// TStatus so each caller gets back its own narrow status type (TerminalStatus
// or AgentSessionStatus) rather than the union of both.
export type ConnState = 'connecting' | 'live' | 'reconnecting' | 'ended';

// Server → client frames. Terminal sessions send `output`/`activity`; agent
// sessions send `message`. Only one side of the union is ever populated for a
// given basePath, but both are declared here since this hook serves both.
type ServerFrame<TStatus extends string> =
  | { type: 'output'; seq: number; data: string }
  | { type: 'message'; seq: number; event: AgentEvent }
  | { type: 'status'; status: TStatus; exitCode?: number | null }
  | { type: 'replay_done' }
  | { type: 'notice'; message: string }
  | { type: 'activity'; busy: boolean; command?: string; exitCode?: number; integrated?: boolean };

// Shell-integrated (OSC 133) activity, mirrored from the server `activity`
// frame. Only populated once `integrated` has latched true.
export interface SessionActivity {
  busy: boolean;
  command?: string;
  exitCode?: number;
}

// Close code the server uses for an unknown/dead session — do NOT reconnect.
const UNKNOWN_SESSION_CODE = 4404;
const BACKOFF_MIN = 500;
const BACKOFF_MAX = 8000;

// Covers both TerminalStatus ('exited' | 'failed') and AgentSessionStatus
// ('exited' | 'failed' | 'interrupted') — a plain string[] since the check
// below runs against whichever TStatus the caller instantiated.
const ENDED_STATES: string[] = ['exited', 'failed', 'interrupted'];

function socketUrl(basePath: string, sessionId: number): string {
  const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${scheme}://${window.location.host}${basePath}/${sessionId}/socket`;
}

// Owns the WebSocket lifecycle for one session: connect, attach from the last
// seq seen, replay-then-live, and reconnect with backoff on an unexpected drop
// — without ever tearing the process down. Output/messages are handed to the
// caller in order; the caller never sees the socket. The load-bearing piece is
// `lastSeqRef`: on reconnect we attach from it, so the server replays exactly
// what we missed and nothing is duplicated or lost.
export function useSessionSocket<TStatus extends string = TerminalStatus | AgentSessionStatus>(
  sessionId: number,
  handlers: {
    basePath: string;
    onData?: (data: string) => void;
    onMessage?: (seq: number, event: AgentEvent) => void;
  },
) {
  const [conn, setConn] = useState<ConnState>('connecting');
  const [status, setStatus] = useState<TStatus | null>(null);
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [truncated, setTruncated] = useState(false);
  // Whether this session has shell integration (OSC 133): once true (learned
  // from the attach frame's `integrated` flag), it never resets — only the
  // attach frame carries it, so a later frame lacking it must not un-latch.
  const [integrated, setIntegrated] = useState(false);
  const [activity, setActivity] = useState<SessionActivity | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const lastSeqRef = useRef(0);
  const backoffRef = useRef(BACKOFF_MIN);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endedRef = useRef(false);
  const disposedRef = useRef(false);
  const basePath = handlers.basePath;
  // Keep the latest handlers without re-running the connect effect.
  const onDataRef = useRef(handlers.onData);
  onDataRef.current = handlers.onData;
  const onMessageRef = useRef(handlers.onMessage);
  onMessageRef.current = handlers.onMessage;

  useEffect(() => {
    disposedRef.current = false;
    endedRef.current = false;
    lastSeqRef.current = 0;
    backoffRef.current = BACKOFF_MIN;

    function scheduleReconnect() {
      if (disposedRef.current || endedRef.current) return;
      setConn('reconnecting');
      const delay = backoffRef.current;
      backoffRef.current = Math.min(BACKOFF_MAX, backoffRef.current * 2);
      timerRef.current = setTimeout(connect, delay);
    }

    function connect() {
      if (disposedRef.current) return;
      const ws = new WebSocket(socketUrl(basePath, sessionId));
      wsRef.current = ws;

      ws.addEventListener('open', () => {
        ws.send(JSON.stringify({ type: 'attach', lastSeq: lastSeqRef.current }));
      });

      ws.addEventListener('message', (ev) => {
        let frame: ServerFrame<TStatus>;
        try {
          frame = JSON.parse(String(ev.data)) as ServerFrame<TStatus>;
        } catch {
          return;
        }
        switch (frame.type) {
          case 'output':
            lastSeqRef.current = frame.seq;
            onDataRef.current?.(frame.data);
            return;
          case 'message':
            lastSeqRef.current = frame.seq;
            onMessageRef.current?.(frame.seq, frame.event);
            return;
          case 'status':
            setStatus(frame.status);
            if (ENDED_STATES.includes(frame.status)) {
              endedRef.current = true;
              setExitCode(frame.exitCode ?? null);
              setConn('ended');
              ws.close();
            }
            return;
          case 'replay_done':
            // Caught up — live, and a healthy connection resets the backoff.
            if (!endedRef.current) setConn('live');
            backoffRef.current = BACKOFF_MIN;
            return;
          case 'notice':
            setTruncated(true);
            return;
          case 'activity':
            setIntegrated((v) => v || Boolean(frame.integrated));
            setActivity({ busy: frame.busy, command: frame.command, exitCode: frame.exitCode });
            return;
        }
      });

      ws.addEventListener('close', (ev) => {
        if (disposedRef.current || endedRef.current) return;
        if (ev.code === UNKNOWN_SESSION_CODE) {
          // The process is gone (or never existed under this API lifetime).
          endedRef.current = true;
          setConn('ended');
          return;
        }
        scheduleReconnect();
      });

      // 'error' is followed by 'close'; let close drive reconnect.
      ws.addEventListener('error', () => {});
    }

    connect();

    return () => {
      disposedRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [sessionId, basePath]);

  function send(frame: object) {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(frame));
  }

  return {
    conn,
    status,
    exitCode,
    truncated,
    integrated,
    activity,
    sendInput: (data: string) => send({ type: 'input', data }),
    sendResize: (cols: number, rows: number) => send({ type: 'resize', cols, rows }),
    sendPrompt: (text: string) => send({ type: 'prompt', text }),
    sendPermission: (requestId: string, result: 'allow' | 'deny', reason?: string) =>
      send({ type: 'permission', requestId, result, reason }),
    interrupt: () => send({ type: 'interrupt' }),
  };
}
