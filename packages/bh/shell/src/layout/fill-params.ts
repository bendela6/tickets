// A route pattern with its `$name` placeholders filled from the page's params.

/**
 * A route pattern with its `$name` placeholders filled in.
 *
 * Each `$name` becomes its URL-encoded value; one with no value stays as
 * `$name`, so a missing param shows in the address rather than vanishing.
 *
 * @param pattern A route pattern, e.g. `/books/$id/copies`.
 * @param params The values, by placeholder name.
 */
export function fillParams(pattern: string, params: Record<string, string> | undefined): string {
  return pattern.replace(/\$([A-Za-z0-9_]+)/g, (match, name: string) => {
    const value = params?.[name];
    if (value === undefined) {
      return match;
    }
    return encodeURIComponent(value);
  });
}
