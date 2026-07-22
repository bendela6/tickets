import { createDbClient } from '@tickets/db';
import { buildApp } from './app';
import { environment } from './environment';
import { createOutboxWorker } from './outbox/worker';
import { initApiSignals } from './signals';
import './automation/rules'; // side-effect: register all automations

const { db } = createDbClient();
const signals = await initApiSignals();
const app = buildApp({ db, signals });
const worker = createOutboxWorker(db, { pollMs: environment.outboxPollMs });
worker.start();

const shutdown = async () => {
  await worker.stop();
  await app.close();
  await signals?.flush();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());

await app.listen({ port: environment.apiPort, host: environment.apiHost });
console.log(`tickets api listening on http://${environment.apiHost}:${environment.apiPort} (outbox worker running)`);
