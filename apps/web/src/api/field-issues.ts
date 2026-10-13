/**
 * The API refuses bad input as `invalid command input: field: message; …`
 * (apps/api/src/utils/parse-body.ts `describeIssues`). Each `field: message`
 * is picked out for the fields named, so the message shows at its field; what
 * names none of them is returned as `rest`.
 */
export function fieldIssues<K extends string>(
  message: string,
  fields: readonly K[],
): { byField: Partial<Record<K, string>>; rest: string | null } {
  const match = /^invalid command input: (.*)$/s.exec(message);
  if (!match) return { byField: {}, rest: message };
  const byField: Partial<Record<K, string>> = {};
  const rest: string[] = [];
  for (const issue of match[1]!.split('; ')) {
    const field = fields.find((name) => issue.startsWith(`${name}: `));
    if (field && byField[field] === undefined) byField[field] = issue.slice(field.length + 2);
    else rest.push(issue);
  }
  return { byField, rest: rest.length > 0 ? rest.join('; ') : null };
}
