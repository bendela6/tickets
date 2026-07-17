import { createDbClient } from '@tickets/db';
import { buildApp } from './app';
import { environment } from './environment';
import { createOutboxWorker } from './outbox/worker';
import './automation/rules'; // side-effect: register all automations

const { db } = createDbClient();
const app = buildApp({ db });
const worker = createOutboxWorker(db, { pollMs: environment.outboxPollMs });
worker.start();

const shutdown = async () => {
  await worker.stop();
  await app.close();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());

await app.listen({ port: environment.apiPort, host: environment.apiHost });
console.log(`tickets api listening on http://${environment.apiHost}:${environment.apiPort} (outbox worker running)`);
