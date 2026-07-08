import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { defineConfig } from 'drizzle-kit';

// Standalone studio config (`pnpm db:studio`) — browses the POSTGRES_DATABASE
// database. drizzle-kit doesn't read .env, so load it here the same way
// packages/db/src/environment.ts does. NOT used for generate/migrate;
// packages/db/drizzle.config.ts owns those.
let current = resolve(process.cwd());
for (let depth = 0; depth < 5; depth++) {
  const candidate = join(current, '.env');
  if (existsSync(candidate)) {
    process.loadEnvFile(candidate);
    break;
  }
  const parent = dirname(current);
  if (parent === current) break;
  current = parent;
}

export default defineConfig({
  dialect: 'postgresql',
  dbCredentials: {
    host: process.env.POSTGRES_HOST ?? '127.0.0.1',
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    user: process.env.POSTGRES_USER ?? 'postgres',
    password: process.env.POSTGRES_PASSWORD ?? 'postgres',
    database: process.env.POSTGRES_DATABASE ?? 'tickets',
  },
});
