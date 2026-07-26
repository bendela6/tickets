import { captureEvent } from '@bendela6/signals-node';
import { createDbClient, environment as dbEnvironment } from '@tickets/db';
import { buildApp } from './app';
import { rootCauseMessage, waitForDb } from './db-ready';
import { environment } from './environment';
import { createOutboxWorker } from './outbox/worker';
import { initApiSignals } from './signals';
import './automation/rules'; // side-effect: register all automations

const { db } = createDbClient();

// Refuse to serve without a database. See db-ready.ts for why this waits
// rather than exiting on the first failed probe.
const ready = await waitForDb(db);
if (!ready.ok) {
  // host:port only — never the connection URL, which carries the password.
  const { host, port, database } = dbEnvironment.postgres;
  console.error(
    `[db] unreachable at ${host}:${port}/${database} after ${ready.attempts} attempts — not starting the API.`,
  );
  console.error(rootCauseMessage(ready.lastError));
  process.exit(1);
}

const signals = await initApiSignals();
const app = buildApp({ db, signals });
const worker = createOutboxWorker(db, { pollMs: environment.outboxPollMs });
worker.start();

const shutdown = async () => {
  captureEvent('api.shutdown');
  await worker.stop();
  await app.close();
  await signals?.flush();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());

await app.listen({ port: environment.apiPort, host: environment.apiHost });
captureEvent('api.boot', { port: environment.apiPort, environment: environment.nodeEnv });
console.log(`tickets api listening on http://${environment.apiHost}:${environment.apiPort} (outbox worker running)`);
