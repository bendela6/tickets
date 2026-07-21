import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

// The only place in the app that reads process.env.
function findEnvFile(): string | null {
  let current = resolve(process.cwd());
  for (let depth = 0; depth < 5; depth++) {
    const candidate = join(current, '.env');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
  return null;
}

const envFile = findEnvFile();
if (envFile) {
  process.loadEnvFile(envFile);
}

export const environment = {
  port: Number(process.env.SIGNALS_PORT ?? 4640),
  // 127.0.0.1 for local dev; containers set SIGNALS_HOST=0.0.0.0
  host: process.env.SIGNALS_HOST ?? '127.0.0.1',
  // host:port advertised inside DSNs returned by the management API
  publicAddress: process.env.SIGNALS_PUBLIC_ADDRESS ?? '127.0.0.1:4640',
  postgres: {
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    user: process.env.POSTGRES_USER ?? 'postgres',
    password: process.env.POSTGRES_PASSWORD ?? 'postgres',
    // deliberately NOT POSTGRES_DATABASE — signals owns its own database
    // and must not follow the tickets/tickets_dev switch
    database: process.env.SIGNALS_DATABASE ?? 'signals',
  },
};

const { host, port, user, password, database } = environment.postgres;
export const connectionUrl = `postgres://${user}:${password}@${host}:${port}/${database}`;
