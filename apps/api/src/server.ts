import { createDbClient } from '@tickets/db';
import { buildApp } from './app';
import { environment } from './environment';

const { db } = createDbClient();
const app = buildApp({ db });

await app.listen({ port: environment.apiPort, host: environment.apiHost });
console.log(`tickets api listening on http://${environment.apiHost}:${environment.apiPort}`);
