import { HttpError } from '../errors';
import type { ProjectVocab } from '../vocab/load-project-vocab';

export function resolveStatus(vocab: ProjectVocab, typeId: number, key: string) {
  const status = vocab.statusByTypeKey.get(`${typeId}:${key}`);
  if (!status || status.archivedAt) {
    throw new HttpError(400, `unknown status "${key}" for this ticket type`);
  }
  return status;
}

export function initialStatusFor(vocab: ProjectVocab, typeId: number) {
  return vocab.initialStatusByTypeId.get(typeId);
}
