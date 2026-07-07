import type { Db } from '../client';
import { projects, views } from '../schema';
import type { ViewColumnDef } from './scheme-types';
import { SOFTWARE_SCHEME } from './software-scheme';

// A project now binds to a pre-seeded scheme and only owns its default view;
// all types/statuses/fields/links come from the scheme.
export async function seedProject(
  db: Db,
  input: {
    key: string;
    name: string;
    ticketPrefix: string;
    schemeId: number;
    fieldIdByKey: Record<string, number>;
  },
) {
  return db.transaction(async (tx) => {
    const [project] = await tx
      .insert(projects)
      .values({
        key: input.key,
        name: input.name,
        ticketPrefix: input.ticketPrefix,
        schemeId: input.schemeId,
      })
      .returning();
    if (!project) throw new Error('project insert returned no row');

    const resolveColumn = (col: ViewColumnDef): Record<string, unknown> => {
      if (col.source === 'field') {
        const fieldId = input.fieldIdByKey[col.fieldKey];
        if (fieldId === undefined) {
          throw new Error(`default view references unknown field ${col.fieldKey}`);
        }
        return { source: 'field', fieldId };
      }
      return { source: col.source };
    };

    const view = SOFTWARE_SCHEME.defaultView;
    const sort =
      view.sort.source === 'field'
        ? { source: 'field', fieldId: input.fieldIdByKey[view.sort.fieldKey!], dir: view.sort.dir }
        : { source: view.sort.source, dir: view.sort.dir };

    await tx.insert(views).values({
      projectId: project.id,
      name: view.name,
      position: 0,
      config: { columns: view.columns.map(resolveColumn), sort, filters: {} },
    });

    return { project };
  });
}
