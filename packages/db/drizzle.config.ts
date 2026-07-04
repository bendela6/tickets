import { defineConfig } from 'drizzle-kit';
import { connectionUrl } from './src/environment';

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: connectionUrl },
});
