export function depsKey(deps: Record<string, unknown>): string {
  return stringify(deps);
}

function stringify(value: unknown): string {
  if (value === undefined || value === null) {
    return 'null';
  }
  if (typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stringify).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const entries = Object.keys(obj).sort();
  return `{${entries.map((k) => `${JSON.stringify(k)}:${stringify(obj[k])}`).join(',')}}`;
}
