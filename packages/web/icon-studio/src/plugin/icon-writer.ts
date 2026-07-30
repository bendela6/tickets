import { readFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import type { Plugin } from 'vite';
import { DEFAULT_CONFIG } from '../config';
import { MAX_BYTES } from './validate';
import { runGenerate } from './write';

/**
 * The dev server may be bound wider than localhost, so the write routes check
 * the peer explicitly rather than relying on the bind address.
 */
export function isLoopback(address: string | undefined): boolean {
  if (!address) return false;
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1', 'localhost'].includes(address);
}

/** Four PNGs plus JSON overhead; generous but bounded. */
const BODY_LIMIT = MAX_BYTES * 6;

export async function readBody(req: IncomingMessage, limit = BODY_LIMIT): Promise<string> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    total += (chunk as Buffer).byteLength;
    if (total > limit) throw new Error('request body too large');
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function send(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(body);
}

/**
 * True for Node's own fs error objects (ENOENT, EACCES, EPERM, EBUSY, …) —
 * exactly the class of error whose message embeds a host absolute path (and
 * therefore the OS username). Everything else — a JSON.parse SyntaxError, a
 * runGenerate validation error — carries no such path and is safe to relay
 * to the browser verbatim. Checking for a string `code` rather than
 * pattern-matching the message is what makes this reliable.
 */
function isFsError(error: unknown): error is NodeJS.ErrnoException {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
  );
}

export function iconWriter({ repoRoot }: { repoRoot: string }): Plugin {
  return {
    name: 'icon-writer',
    // Never part of a build: these routes cannot ship.
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0];
        if (url !== '/__icons/config' && url !== '/__icons/generate') return next();

        if (!isLoopback(req.socket.remoteAddress ?? undefined)) {
          send(res, 403, { error: 'icon studio only accepts loopback requests' });
          return;
        }

        if (url === '/__icons/config') {
          if (req.method !== 'GET') return send(res, 405, { error: 'GET only' });
          const file = path.resolve(repoRoot, 'apps/web/icons.config.json');
          try {
            send(res, 200, JSON.parse(await readFile(file, 'utf8')));
          } catch (error) {
            if (isFsError(error) && error.code === 'ENOENT') {
              // No config file committed yet — hand back the locked defaults.
              send(res, 200, DEFAULT_CONFIG);
              return;
            }
            // The file exists but couldn't be read or parsed. Falling back
            // to the defaults here would look identical to "nothing
            // changed", and a later Generate would silently overwrite a
            // real, hand-edited config with them — so this must surface as
            // an error, never as a quiet substitution.
            console.error('[icon-writer] reading apps/web/icons.config.json failed:', error);
            const reason = isFsError(error)
              ? `could not be read (${error.code})`
              : error instanceof Error
                ? error.message
                : 'could not be read';
            send(res, 500, { error: `apps/web/icons.config.json ${reason}` });
          }
          return;
        }

        if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
        try {
          const body = JSON.parse(await readBody(req));
          send(res, 200, await runGenerate(body, repoRoot));
        } catch (error) {
          if (isFsError(error)) {
            // Node fs errors (from writeIfChanged's mkdir/writeFile/rename)
            // embed an absolute host path, and therefore the OS username.
            // The dev console gets the full error; the browser gets only
            // the operation and the error code.
            console.error('[icon-writer] generate failed:', error);
            send(res, 500, { error: `writing generated assets failed (${error.code})` });
            return;
          }
          // Validation errors from runGenerate's assertRequest, and
          // JSON.parse errors on the request body, carry no host detail —
          // they're the whole point of the 400, so relay them verbatim.
          send(res, 400, { error: error instanceof Error ? error.message : 'generate failed' });
        }
      });
    },
  };
}
