import type { StandardSchemaV1 } from '@standard-schema/spec';

/** A Standard Schema issue's path, dotted: `columns.0.name`. */
export function pathOf(issue: StandardSchemaV1.Issue): string {
  return (issue.path ?? [])
    .map((segment) => (typeof segment === 'object' ? segment.key : segment))
    .map(String)
    .join('.');
}
