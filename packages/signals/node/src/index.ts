import * as os from 'node:os';
import { createClient, type ClientOptions, type SignalsClient } from '@bendela6/signals-core';

export * from '@bendela6/signals-core';

export type NodeInitOptions = Omit<ClientOptions, 'platform' | 'sdk'> & {
  registerProcessHandlers?: boolean;
  /**
   * Whether to terminate the process after an uncaught exception has been captured
   * and flushed. Defaults to `true`.
   *
   * Setting this to `false` keeps the process alive after an uncaught exception,
   * which goes against Node's own guidance (see the Node docs for
   * `'uncaughtException'`: "the correct use... is to perform synchronous cleanup
   * of allocated resources... then... shut down the process"). Continuing to run
   * in an unknown state can produce further, harder-to-diagnose failures. The
   * error is always logged to stderr in this mode so the crash stays visible.
   */
  exitOnUncaught?: boolean;
};

let current: SignalsClient | null = null;
let uncaughtHandlerRef: ((error: unknown) => void) | null = null;
let rejectionHandlerRef: ((reason: unknown) => void) | null = null;

export function initSignals(options: NodeInitOptions): SignalsClient {
  const { registerProcessHandlers, exitOnUncaught, ...clientOptions } = options;

  const client = createClient({
    ...clientOptions,
    platform: { runtime: 'node', nodeVersion: process.version, hostname: os.hostname(), pid: process.pid },
    sdk: { name: '@bendela6/signals-node', version: '0.1.0' },
  });

  // repeat init replaces prior listeners rather than stacking them
  if (uncaughtHandlerRef) {
    process.off('uncaughtException', uncaughtHandlerRef);
    uncaughtHandlerRef = null;
  }
  if (rejectionHandlerRef) {
    process.off('unhandledRejection', rejectionHandlerRef);
    rejectionHandlerRef = null;
  }

  if (registerProcessHandlers !== false) {
    uncaughtHandlerRef = buildUncaughtListener(client, { exitOnUncaught });
    rejectionHandlerRef = (reason: unknown) => { handleRejection(client, reason); };
    process.on('uncaughtException', uncaughtHandlerRef);
    process.on('unhandledRejection', rejectionHandlerRef);
  }

  current = client;
  return client;
}

export function getClient(): SignalsClient | null {
  return current;
}

export async function handleUncaught(
  client: SignalsClient,
  error: unknown,
  exit: (code: number) => void = (code) => process.exit(code),
): Promise<void> {
  client.captureError(error, { mechanism: 'uncaught-exception' });
  try {
    await Promise.race([client.flush(), new Promise((resolve) => setTimeout(resolve, 2000))]);
  } catch {
    // flush failure must not mask the exit
  } finally {
    exit(1);
  }
}

export function handleRejection(client: SignalsClient, reason: unknown): void {
  client.captureError(reason, { mechanism: 'unhandled-rejection' });
}

/**
 * Builds the listener registered for `process.on('uncaughtException', ...)`.
 *
 * When `exitOnUncaught` is `false` the process is not terminated, so the error
 * is logged to stderr first to preserve the visibility Node's default handler
 * would otherwise have given it — see the `exitOnUncaught` doc comment above
 * for why this mode is discouraged.
 */
export function buildUncaughtListener(
  client: SignalsClient,
  { exitOnUncaught }: { exitOnUncaught?: boolean },
): (error: unknown) => void {
  const willExit = exitOnUncaught !== false;
  const exit = willExit ? (code: number) => process.exit(code) : () => {};
  return (error: unknown) => {
    if (!willExit) {
      console.error('[signals] uncaught exception (exitOnUncaught: false):', error);
    }
    void handleUncaught(client, error, exit);
  };
}

export interface ExpressLikeRequest {
  method: string;
  url: string;
  originalUrl?: string;
}
export type ExpressErrorHandler = (
  err: unknown,
  req: ExpressLikeRequest,
  res: unknown,
  next: (err?: unknown) => void,
) => void;

export function expressErrorHandler(client: SignalsClient): ExpressErrorHandler {
  return (err, req, _res, next) => {
    try {
      client.captureError(err, {
        mechanism: 'middleware',
        contexts: { http: { method: req?.method, url: req?.originalUrl ?? req?.url } },
      });
    } catch {
      // never let a malformed request throw out of the error handler
    } finally {
      next(err);
    }
  };
}

export interface FastifyLikeRequest {
  method: string;
  url: string;
}
export type FastifyErrorHook = (error: unknown, request: FastifyLikeRequest) => void;

export function fastifyErrorHook(client: SignalsClient): FastifyErrorHook {
  return (error, request) => {
    try {
      client.captureError(error, {
        mechanism: 'middleware',
        contexts: { http: { method: request?.method, url: request?.url } },
      });
    } catch {
      // never let a malformed request throw out of the error hook
    }
  };
}
