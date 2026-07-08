import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

// The only place in the package that reads process.env. The .env lives at the
// workspace root; walk up from cwd so this works from any package directory
// (and inside drizzle-kit's config bundler, where import.meta is unavailable).
function findEnvFile(): string | null {
  let current = resolve(process.cwd());
  for (let depth = 0; depth < 5; depth++) {
    const candidate = join(current, '.env');
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
  return null;
}

const envFile = findEnvFile();
if (envFile) {
  process.loadEnvFile(envFile);
}

export const environment = {
  postgres: {
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    user: process.env.POSTGRES_USER ?? 'postgres',
    password: process.env.POSTGRES_PASSWORD ?? 'postgres',
    database: process.env.POSTGRES_DATABASE ?? 'tickets',
  },
};

const { host, port, user, password, database } = environment.postgres;
export const connectionUrl = `postgres://${user}:${password}@${host}:${port}/${database}`;
