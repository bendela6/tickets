import { HttpError } from '../errors';
import type { ProjectVocab } from '../vocab/load-project-vocab';

// Link types are owned by their source ticket type: resolve `key` against
// only the types the source owns, then check the target type is one of the
// link type's allowed targets. Used by `createLink` to guard link creation.
export function resolveLinkForCreate(
  vocab: ProjectVocab,
  sourceTypeId: number,
  targetTypeId: number,
  key: string,
) {
  const owned = vocab.linkTypesByType.get(sourceTypeId) ?? [];
  const linkType = owned.find((candidate) => candidate.key === key && !candidate.archivedAt);
  if (!linkType) {
    throw new HttpError(400, `type does not own link "${key}"`);
  }
  const allowed = vocab.linkTypeTargets.get(linkType.id) ?? new Set<number>();
  if (!allowed.has(targetTypeId)) {
    throw new HttpError(422, `"${key}" cannot target this ticket type`);
  }
  return linkType;
}
