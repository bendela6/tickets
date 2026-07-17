// packages/db/src/import/kind-map.ts
// The nine free-text kinds the old audit trail emitted, and their new names.
// These rows import as version 0: lossy, display-only, never folded.
export const LEGACY_KIND_MAP: Record<string, string> = {
  created: 'item.created',            // payload { values: { fieldKey: value } }
  archived: 'item.archived',          // payload {}
  unarchived: 'item.unarchived',      // payload {}
  commented: 'item.comment_added',    // payload { commentId }
  'parent-changed': 'item.reparented',// payload { from, to } — item ids, still valid
  'status-changed': 'item.field_changed', // payload { fieldId, fieldKey, from, to }
  'value-changed': 'item.field_changed',  // payload { fieldId, fieldKey, from, to }
  'link-added': 'item.link_added',    // payload { linkId, linkTypeKey }
  'link-removed': 'item.link_removed',// payload { linkId }
};

export function mapKind(legacy: string): string {
  const mapped = LEGACY_KIND_MAP[legacy];
  if (!mapped) throw new Error(`unmapped legacy event kind "${legacy}"`);
  return mapped;
}
