import type { Db } from '../client';
import { projects, views } from '../schema';
import { softwareScheme } from './software-scheme';

// A project now binds to a pre-seeded scheme and only owns its default view;
// all types/fields/option sets/links come from the scheme. The default
// view's columns/sort are stored verbatim as fieldKey — softwareScheme's
// defaultView is already fieldKey-shaped, so there's no id translation here.
export async function seedProject(
  db: Db,
  input: { key: string; name: string; itemPrefix: string; schemeId: number },
) {
  return db.transaction(async (tx) => {
    const [project] = await tx
      .insert(projects)
      .values({
        key: input.key,
        name: input.name,
        itemPrefix: input.itemPrefix,
        schemeId: input.schemeId,
      })
      .returning();
    if (!project) throw new Error('project insert returned no row');

    const view = softwareScheme.defaultView;
    await tx.insert(views).values({
      projectId: project.id,
      name: view.name,
      position: 0,
      config: { columns: view.columns, sort: view.sort, filters: {} }, // fieldKey-shaped already
    });

    return { project };
  });
}
