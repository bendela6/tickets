import { useEffect, useRef, useState } from 'react';
import type { AgentEvent, SessionStatus } from '../../api/types';
import type { ConnState } from './terminal-frame';

// Re-exported so callers (e.g. terminal-display.ts) can depend on the socket
// module without reaching into terminal-frame directly.
export type { ConnState };

// Server → client frames (mirror of apps/api ServerFrame). Terminal sessions use
// `output`; agent sessions use `message`.
type ServerFrame =
  | { type: 'output'; seq: number; data: string }
  | { type: 'message'; seq: number; event: AgentEvent }
  | { type: 'status'; status: SessionStatus; exitCode?: number | null }
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

const ENDED_STATES: SessionStatus[] = ['exited', 'failed', 'interrupted'];

function socketUrl(sessionId: number): string {
  const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${scheme}://${window.location.host}/api/ai/sessions/${sessionId}/socket`;
}

// Owns the WebSocket lifecycle for one terminal session: connect, attach from
// the last seq seen, replay-then-live, and reconnect with backoff on an
// unexpected drop — without ever tearing the process down. Output is handed to
// `onData` in order; the caller (xterm) never sees the socket. The load-bearing
// piece is `lastSeqRef`: on reconnect we attach from it, so the server replays
// exactly what we missed and nothing is duplicated or lost.
export function useSessionSocket(
  sessionId: number,
  handlers: { onData?: (data: string) => void; onMessage?: (seq: number, event: AgentEvent) => void },
) {
  const [conn, setConn] = useState<ConnState>('connecting');
  const [status, setStatus] = useState<SessionStatus | null>(null);
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
      const ws = new WebSocket(socketUrl(sessionId));
      wsRef.current = ws;

      ws.addEventListener('open', () => {
        ws.send(JSON.stringify({ type: 'attach', lastSeq: lastSeqRef.current }));
      });

      ws.addEventListener('message', (ev) => {
        let frame: ServerFrame;
        try {
          frame = JSON.parse(String(ev.data)) as ServerFrame;
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
  }, [sessionId]);

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
