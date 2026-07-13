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

import type { Field, Model, Relationship } from '../types';

export function isDerivableShaped(r: Relationship): boolean {
  return (
    r.kind === 'fk' &&
    r.label === null &&
    r.cardinality === '1-n' &&
    r.id === `e-${r.source}.${r.sourceField}->${r.target}.${r.targetField}`
  );
}

// The field a derivable-shaped rel's id scheme implies as its backing field
// (same entity+field as the rel's target/targetField), IF its ref/refField
// still actually point back at the rel's source/sourceField. Not exported:
// both booleans below are built from it so they can't drift apart.
function matchingField(model: Model, r: Relationship): Field | undefined {
  const f = model.entityById.get(r.target)?.fields.find((x) => x.name === r.targetField);
  return f && f.ref === r.source && (f.refField ?? 'id') === r.sourceField ? f : undefined;
}

// Whether SOME field still carries the ref/refField this rel's shape implies,
// regardless of whether that field is tagged role:'fk'. A field can lose its
// 'fk' tag while keeping ref/refField intact (e.g. a shared-pk identifying
// reference like the seed's outbox.event_id: role 'pk', ref 'events') — that
// still counts as "backed" even though apply-model-edit's derive loop (which
// only fires for role:'fk' fields) will never regenerate it. Used by
// apply-model-edit to tell "nothing backs this anymore, safe to drop" apart
// from "something backs it, but not by re-derivation — keep it verbatim".
export function hasBackingField(model: Model, r: Relationship): boolean {
  return !!matchingField(model, r);
}

// Whether a relationship is safe to omit entirely — from the saved file
// (serialize-model) or from the kept-verbatim set before re-deriving
// (apply-model-edit) — because a role:'fk' field will reproduce it exactly,
// byte-for-byte, on the very next load/edit: derivable shape AND a
// same-direction role:'fk' field still backing it. Sharing this (and
// hasBackingField, above) between both call sites is what keeps their "is this
// rel doing anything a human/tool couldn't reproduce" checks from drifting —
// see each call site's own comment for the specific bug that drift caused.
export function isFullyReDerivable(model: Model, r: Relationship): boolean {
  if (!isDerivableShaped(r)) return false;
  return matchingField(model, r)?.role === 'fk';
}
