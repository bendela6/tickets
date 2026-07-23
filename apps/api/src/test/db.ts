import { createDbClient, ensureSoftwareScheme, ensureUser, seedProject } from '@tickets/db';
import type { Db } from '@tickets/db';

if (process.env.POSTGRES_DATABASE !== 'tickets_test') {
  throw new Error(
    `api tests must run against tickets_test, not "${process.env.POSTGRES_DATABASE}". ` +
      'Set POSTGRES_DATABASE=tickets_test.',
  );
}

const client = createDbClient({ max: 1 });
export const testDb: Db = client.db;

// Every table, child-first, so a plain TRUNCATE ... CASCADE resets cleanly.
const TABLES = [
  'outbox', 'events', 'commands', 'item_activity',
  'item_links', 'comment_reactions', 'comments', 'item_values', 'items',
  'option_transitions', 'link_type_target_types', 'link_types', 'options', 'option_sets',
  'item_type_fields', 'item_type_child_types', 'fields', 'item_types',
  'views', 'projects', 'schemes', 'users', 'attachments',
];

export async function resetDb(): Promise<void> {
  await client.sql.unsafe(
    `TRUNCATE ${TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`,
  );
}

export interface Fixture {
  schemeId: number;
  projectKey: string;
  projectId: number;
  actorId: number;
  typeIdByKey: Map<string, number>;
  fieldIdByKey: Map<string, number>;
  optionIdByKey: Map<string, number>;
}

export async function seedFixture(): Promise<Fixture> {
  const scheme = await ensureSoftwareScheme(testDb);
  const actorId = await ensureUser(testDb, { name: 'tester', kind: 'human' });
  // seedProject returns { project }, not the project row itself.
  const { project } = await seedProject(testDb, {
    key: 'test',
    name: 'Test',
    itemPrefix: 'TST',
    schemeId: scheme.schemeId,
  });
  return {
    schemeId: scheme.schemeId,
    projectKey: 'test',
    projectId: project.id,
    actorId,
    typeIdByKey: scheme.typeIdByKey,
    fieldIdByKey: scheme.fieldIdByKey,
    optionIdByKey: scheme.optionIdByKey,
  };
}
