// Whether a relationship carries nothing beyond what plain fk-field derivation
// would produce for it: derived id scheme, kind 'fk', no label, default '1-n'.
// Such a rel is never authored data — apply-model-edit's deriveRelationships
// re-derives it from the CURRENT fields on every edit (which is what lets
// clearing a field's fk role, even keeping its name, remove the edge), and
// serialize-model's isFullyReDerivable relies on the same shape to know a rel
// is safe to omit from the saved file, because load-model is guaranteed to
// reconstruct it byte-for-byte. Anything with a custom id, a label, or a
// hand-set cardinality is treated as authored and kept verbatim while its
// endpoints stay valid.
//
// Shared by both call sites so their definitions of "derivable shape" cannot
// drift apart: before this was split out, serialize-model's copy omitted the
// id-scheme check, so a hand-authored id that happened to coincide with a
// valid fk field (unlabelled, default cardinality) was silently dropped from
// the saved file and resurrected under the derived id on the next load.

import type { Relationship } from '../types';

export function isDerivableShaped(r: Relationship): boolean {
  return (
    r.kind === 'fk' &&
    r.label === null &&
    r.cardinality === '1-n' &&
    r.id === `e-${r.source}.${r.sourceField}->${r.target}.${r.targetField}`
  );
}
