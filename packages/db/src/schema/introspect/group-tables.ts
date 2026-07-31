import { findGroupKey, qualifiedName, type GroupMeta, type TableMeta } from '../describe-schema';
import { SCHEMA_GROUPS } from '../schema-groups';

/**
 * Hues for namespace fallback groups, ordered so the first few are maximally
 * distinct. Instrument option hue NAMES — the renderer resolves each to
 * `var(--color-<name>-9)` through an explicit map (apps/web's
 * components/eer/adapter/hue-token.ts), which is also what makes Tailwind emit
 * the token at all. Only the `-9` step is consumed; subtler fills are derived
 * from it with color-mix() at the element, not from a `-3` token.
 *
 * A name that map does not carry gets no override, so the group falls back to
 * the diagram's own palette. Adding a hue here without adding it there is a
 * silent downgrade — hue-token.test.ts fails on exactly that.
 * `gray` is absent: it reads as "no group" rather than a hue.
 */
const FALLBACK_HUES = ['blue', 'green', 'orange', 'purple', 'teal', 'cyan', 'pink', 'red', 'yellow'];

const fallbackKey = (schema: string | null) => `ns:${schema ?? 'public'}`;

/**
 * Assign every table a group, curated where the config knows it and per
 * Postgres namespace where it does not.
 *
 * The fallback is what makes this safe to point at ANY database: SCHEMA_GROUPS
 * describes the tickets schema, so introspecting anything else — or a tickets
 * database carrying a table the code has not declared — would otherwise throw
 * (resolveGroupKey) or silently drop the table. A table the code does not know
 * about SHOWING UP is the point: this screen exists to reveal what is actually
 * deployed.
 *
 * Curated groups that matched nothing are dropped, so a foreign database does
 * not render seven empty tickets zones.
 */
export function groupTables(
  tables: Omit<TableMeta, 'group'>[],
): { tables: TableMeta[]; groups: GroupMeta[] } {
  const assigned: TableMeta[] = tables.map((t) => ({
    ...t,
    group: findGroupKey(t.name, SCHEMA_GROUPS, t.schema) ?? fallbackKey(t.schema),
  }));

  const tablesIn = (key: string) =>
    assigned.filter((t) => t.group === key).map((t) => qualifiedName(t.schema, t.name));

  // Curated first, in declaration order — that order is the layout order.
  const curated: GroupMeta[] = SCHEMA_GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    color: g.color,
    tables: tablesIn(g.key),
  })).filter((g) => g.tables.length > 0);

  // Then one group per namespace that needed a fallback, in first-seen order.
  const fallbackKeys: string[] = [];
  for (const t of assigned) {
    if (t.group.startsWith('ns:') && !fallbackKeys.includes(t.group)) fallbackKeys.push(t.group);
  }
  const fallback: GroupMeta[] = fallbackKeys.map((key, i) => ({
    key,
    label: key.slice('ns:'.length).toUpperCase(),
    color: FALLBACK_HUES[i % FALLBACK_HUES.length]!,
    tables: tablesIn(key),
  }));

  return { tables: assigned, groups: [...curated, ...fallback] };
}
