import { eq } from 'drizzle-orm';
import type { DbExecutor } from '@tickets/db';
import { tickets } from '@tickets/db';
import { HttpError } from '../errors';
import type { ProjectVocab } from '../vocab/load-project-vocab';

// pure rule — exported for unit tests
export function assertChildAllowed(
  parentTypeKey: string,
  allowed: string[],
  childTypeKey: string,
): void {
  if (!allowed.includes(childTypeKey)) {
    throw new HttpError(422, `a ${childTypeKey} cannot be nested under a ${parentTypeKey}`);
  }
}

// Hierarchy policy: type-aware nesting (Epic→Task/Bug/Spike→Subtask). The rules
// form a DAG, so they inherently cap depth and prevent cycles.
export async function checkParent(
  db: DbExecutor,
  input: { ticketId: number | null; parentId: number; childTypeKey: string; vocab: ProjectVocab },
): Promise<void> {
  const parentRows = await db.select().from(tickets).where(eq(tickets.id, input.parentId));
  const parent = parentRows[0];
  if (!parent || parent.projectId !== input.vocab.project.id) {
    throw new HttpError(400, 'parent ticket not found in this project');
  }
  if (input.ticketId !== null && input.ticketId === input.parentId) {
    throw new HttpError(422, 'a ticket cannot be its own parent');
  }
  const parentType = input.vocab.typeById.get(parent.typeId);
  const allowed =
    (parentType?.config as { allowedChildTypes?: string[] })?.allowedChildTypes ?? [];
  assertChildAllowed(parentType?.key ?? 'unknown', allowed, input.childTypeKey);
}
