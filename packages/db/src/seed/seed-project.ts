import type { Db } from '../client';
import { projects, views } from '../schema';
import { SOFTWARE_SCHEME } from './software-scheme';

// A project now binds to a pre-seeded scheme and only owns its default view;
// all types/statuses/fields/links come from the scheme. The default view's
// columns/sort are stored verbatim as fieldKey — SOFTWARE_SCHEME.defaultView
// is already fieldKey-shaped, so there's no id translation to do here.
export async function seedProject(
  db: Db,
  input: { key: string; name: string; ticketPrefix: string; schemeId: number },
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

    const view = SOFTWARE_SCHEME.defaultView;
    await tx.insert(views).values({
      projectId: project.id,
      name: view.name,
      position: 0,
      config: { columns: view.columns, sort: view.sort, filters: {} }, // fieldKey-shaped already
    });

    return { project };
  });
}
