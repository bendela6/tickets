import { buildApp } from './app';
import { createDbClient } from './db/client';
import { environment } from './environment';
import { initSelfSignals, reportBoot, reportShutdown } from './signals-self';

const { db } = createDbClient();
const app = buildApp({ db });

// Never throws; a down/broken DB degrades to "no self-monitoring" with a
// single console.warn, and the collector still boots and serves normally.
const selfClient = await initSelfSignals(db);

const shutdown = async () => {
  reportShutdown();
  await selfClient?.flush().catch(() => undefined);
  await app.close();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());

await app.listen({ port: environment.port, host: environment.host });
console.log(`signals collector listening on http://${environment.host}:${environment.port}`);
reportBoot(environment.port, process.env.NODE_ENV ?? 'development');
