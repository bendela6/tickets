// Old project-wide status key + target type key → a status key that exists on
// that type in the Software scheme.
export function mapOldStatusKey(oldKey: string, newTypeKey: string): string {
  const hasBacklog = newTypeKey === 'epic' || newTypeKey === 'task' || newTypeKey === 'bug';
  const entry = newTypeKey === 'bug' ? 'triage' : hasBacklog ? 'backlog' : 'todo';
  const doneKey = newTypeKey === 'bug' ? 'fixed' : 'done';
  const dropKey = newTypeKey === 'bug' ? 'wont-fix' : 'cancelled';
  switch (oldKey) {
    case 'open':
    case 'investigated':
      return entry;
    case 'investigating':
    case 'brainstorming':
    case 'designing':
    case 'in-progress':
      return 'in-progress';
    case 'review':
      return 'in-review';
    case 'blocked':
      return 'blocked';
    case 'fixed':
      return doneKey;
    case 'dropped':
      return dropKey;
    default:
      return entry; // safe fallback; the migration logs any unmapped key
  }
}
