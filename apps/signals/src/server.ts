import { buildApp } from './app';
import { createDbClient } from './db/client';
import { environment } from './environment';

const { db } = createDbClient();
const app = buildApp({ db });

const shutdown = async () => {
  await app.close();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());

await app.listen({ port: environment.port, host: environment.host });
console.log(`signals collector listening on http://${environment.host}:${environment.port}`);
