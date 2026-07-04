import { createDbClient } from '@tickets/db';
import { buildApp } from './app';
import { environment } from './environment';

const { db } = createDbClient();
const app = buildApp({ db });

await app.listen({ port: environment.apiPort, host: '127.0.0.1' });
console.log(`tickets api listening on http://127.0.0.1:${environment.apiPort}`);
