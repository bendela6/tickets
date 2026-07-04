import { HttpError } from '../errors';
import type { ProjectVocab } from '../vocab/load-project-vocab';

// Workflow-graph enforcement. Zero edges in the project = unrestricted.
// With edges: updates need a matching from→to edge; creation needs an entry
// edge (from NULL) only when entry edges exist at all.
export function checkTransition(
  vocab: ProjectVocab,
  input: { fromStatusId: number | null; toStatusId: number; typeId: number },
): void {
  if (vocab.transitions.length === 0) {
    return;
  }
  const applicable = vocab.transitions.filter(
    (edge) => edge.ticketTypeId === null || edge.ticketTypeId === input.typeId,
  );
  if (input.fromStatusId === null) {
    const entryEdges = applicable.filter((edge) => edge.fromStatusId === null);
    if (entryEdges.length === 0) {
      return;
    }
    if (!entryEdges.some((edge) => edge.toStatusId === input.toStatusId)) {
      const status = vocab.statusById.get(input.toStatusId);
      throw new HttpError(422, `"${status?.key}" is not a valid starting status`);
    }
    return;
  }
  const allowed = applicable.some(
    (edge) => edge.fromStatusId === input.fromStatusId && edge.toStatusId === input.toStatusId,
  );
  if (!allowed) {
    const from = vocab.statusById.get(input.fromStatusId);
    const to = vocab.statusById.get(input.toStatusId);
    throw new HttpError(422, `transition ${from?.key} → ${to?.key} is not in the workflow graph`);
  }
}
