import websocketPlugin from '@fastify/websocket';
import { captureError } from '@bendela6/signals-node';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { TerminalDriver } from './driver';
import type { ClientFrame, ServerFrame, Subscriber } from './types';

// Close code for "no such live session". Distinct from a normal close (1000) and
// an abnormal drop (1006), so the browser client can tell a dead session apart
// from a flaky network and decide NOT to auto-reconnect. 4000-4999 is the range
// reserved for application use by the WebSocket spec.
const UNKNOWN_SESSION_CODE = 4404;

// One route bridges a browser WebSocket to the Terminal Driver: the socket is
// just another Subscriber, so the driver stays transport-agnostic and
// unit-testable. The socket owns nothing — closing it detaches but never
// kills the process.
//
// Registered inside an encapsulated child plugin (awaited there) so the
// websocket plugin's onRoute hook is installed before the route is declared;
// declaring a `{ websocket: true }` route before that hook exists silently
// produces a plain HTTP route. This lets buildApp stay synchronous.
export function registerTerminalSocket(app: FastifyInstance, context: { driver: TerminalDriver }): void {
  const { driver } = context;

  app.register(async (instance) => {
    await instance.register(websocketPlugin);

    instance.get(
      '/api/terminal/sessions/:id/socket',
      { websocket: true },
      (socket, req: FastifyRequest) => {
        const id = Number((req.params as { id: string }).id);

        const sub: Subscriber = {
          send: (frame: ServerFrame) => {
            if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(frame));
          },
          close: () => socket.close(),
        };

        let attached = false;

        socket.on('message', (raw: Buffer) => {
          let frame: ClientFrame;
          try {
            frame = JSON.parse(raw.toString()) as ClientFrame;
          } catch (err) {
            // ignore malformed frames rather than tearing down the socket — but
            // a client sending garbage is still worth seeing in Signals.
            captureError(err, { level: 'warning', contexts: { socket: { scope: 'terminal' } } });
            return;
          }

          switch (frame.type) {
            case 'attach': {
              if (attached) return; // one attach per socket
              if (!driver.has(id)) {
                socket.close(UNKNOWN_SESSION_CODE, 'unknown session');
                return;
              }
              attached = true;
              // attach replays persisted output > lastSeq, emits replay_done,
              // then promotes this subscriber to live.
              void driver.attach(id, sub, frame.lastSeq ?? 0);
              return;
            }
            case 'input':
              if (attached) driver.write(id, frame.data);
              return;
            case 'resize':
              if (attached) driver.resize(id, frame.cols, frame.rows);
              return;
            case 'interrupt':
              // Ctrl-C to the foreground process. Does NOT kill the session —
              // that is the stop route.
              if (attached) driver.interrupt(id);
              return;
            default:
              return;
          }
        });

        socket.on('close', () => driver.detach(id, sub));
        socket.on('error', () => driver.detach(id, sub));
      },
    );
  });
}
