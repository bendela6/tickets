import * as os from 'node:os';
import { createClient, type ClientOptions, type SignalsClient } from '@bendela6/signals-core';

export * from '@bendela6/signals-core';

export type NodeInitOptions = Omit<ClientOptions, 'platform' | 'sdk'> & {
  registerProcessHandlers?: boolean;
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
    const exit = exitOnUncaught !== false ? (code: number) => process.exit(code) : () => {};
    uncaughtHandlerRef = (error: unknown) => { handleUncaught(client, error, exit); };
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

export function handleUncaught(
  client: SignalsClient,
  error: unknown,
  exit: (code: number) => void = (code) => process.exit(code),
): void {
  client.captureError(error, { mechanism: 'uncaught-exception' });
  void client.flush();
  exit(1);
}

export function handleRejection(client: SignalsClient, reason: unknown): void {
  client.captureError(reason, { mechanism: 'unhandled-rejection' });
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
    client.captureError(err, {
      mechanism: 'middleware',
      contexts: { http: { method: req.method, url: req.originalUrl ?? req.url } },
    });
    next(err);
  };
}

export interface FastifyLikeRequest {
  method: string;
  url: string;
}
export type FastifyErrorHook = (error: unknown, request: FastifyLikeRequest) => void;

export function fastifyErrorHook(client: SignalsClient): FastifyErrorHook {
  return (error, request) => {
    client.captureError(error, {
      mechanism: 'middleware',
      contexts: { http: { method: request.method, url: request.url } },
    });
  };
}
