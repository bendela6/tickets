// Node-only test helper — touches the filesystem. packages/db's vitest.config.ts
// already runs every suite under environment 'node' (this package has no jsdom
// suites to worry about, unlike the eer app's, where this file originally lived).
//
// Writes generated drizzle source to a temp .ts and imports it, so a test can
// introspect the REAL module the exporter produced rather than trust its
// text. Vitest transpiles the import, so this also proves the file parses.
//
// The temp dir is created UNDER packages/db/node_modules (gitignored, never
// committed) rather than the OS tmp dir: the generated file's own bare
// imports (`drizzle-orm`, `drizzle-orm/pg-core`) resolve by Node/vite walking
// up from the importing file looking for a `node_modules` — a location
// outside the package (e.g. the OS tmp dir) has no such ancestor and both
// Vite's dev-server fs allowlist and its bare-specifier resolution fail.
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DB_ROOT = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url))))); // src/schema/drizzle-roundtrip -> packages/db

export async function loadGeneratedModule(source: string): Promise<Record<string, unknown>> {
  const dir = await mkdtemp(join(DB_ROOT, 'node_modules', '.db-gen-'));
  const file = join(dir, 'schema.generated.ts');
  await writeFile(file, source, 'utf8');
  try {
    return (await import(/* @vite-ignore */ pathToFileURL(file).href)) as Record<string, unknown>;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
