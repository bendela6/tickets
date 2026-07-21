import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { FastifyInstance } from 'fastify';

let cached: string | null = null;

function loadBundle(): string | null {
  if (cached !== null) return cached;
  try {
    const require = createRequire(import.meta.url);
    const pkgPath = require.resolve('@bendela6/signals-browser/package.json');
    cached = readFileSync(join(dirname(pkgPath), 'dist', 'sdk.js'), 'utf8');
    return cached;
  } catch {
    return null;
  }
}

export function registerSdkRoutes(app: FastifyInstance) {
  app.get('/sdk.js', async (_request, reply) => {
    const bundle = loadBundle();
    if (bundle === null) {
      reply.status(503).send({ error: 'sdk bundle not built — run pnpm --filter @bendela6/signals-browser build' });
      return;
    }
    reply
      .header('content-type', 'application/javascript; charset=utf-8')
      .header('access-control-allow-origin', '*')
      .header('cache-control', 'public, max-age=300')
      .send(bundle);
  });
}
