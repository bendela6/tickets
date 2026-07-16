import { useEffect, useRef, useState } from 'react';
import type { SessionStatus } from '../../api/types';
import type { ConnState } from './terminal-frame';

// Server → client frames (mirror of apps/api ServerFrame; terminal subset).
type ServerFrame =
  | { type: 'output'; seq: number; data: string }
  | { type: 'status'; status: SessionStatus; exitCode?: number | null }
  | { type: 'replay_done' }
  | { type: 'notice'; message: string };

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
  handlers: { onData: (data: string) => void },
) {
  const [conn, setConn] = useState<ConnState>('connecting');
  const [status, setStatus] = useState<SessionStatus | null>(null);
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [truncated, setTruncated] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const lastSeqRef = useRef(0);
  const backoffRef = useRef(BACKOFF_MIN);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endedRef = useRef(false);
  const disposedRef = useRef(false);
  // Keep the latest onData without re-running the connect effect.
  const onDataRef = useRef(handlers.onData);
  onDataRef.current = handlers.onData;

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
            onDataRef.current(frame.data);
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
    sendInput: (data: string) => send({ type: 'input', data }),
    sendResize: (cols: number, rows: number) => send({ type: 'resize', cols, rows }),
    interrupt: () => send({ type: 'interrupt' }),
  };
}
