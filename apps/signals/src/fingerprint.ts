import { createHash } from 'node:crypto';
import type { StackFrame } from './types';

// Order matters: uuid → 0x-hex → long hex tokens → remaining digit runs.
export function normalizeMessage(message: string): string {
  return message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<uuid>')
    .replace(/\b0x[0-9a-f]+\b/gi, '<hex>')
    .replace(/\b[0-9a-f]*[0-9][0-9a-f]{6,}\b|\b[0-9a-f]{7,}\b/gi, '<hash>')
    .replace(/\d+/g, '<n>');
}

export function fingerprintError(input: {
  name: string;
  message?: string;
  stack?: StackFrame[];
  explicit?: string;
}): string {
  if (input.explicit) return input.explicit;
  const frames = (input.stack ?? [])
    .filter((f) => f.inApp)
    .slice(0, 5)
    .map((f) => `${f.functionName}@${f.file}`);
  const basis = [input.name, normalizeMessage(input.message ?? ''), ...frames].join('\n');
  return createHash('sha256').update(basis).digest('hex').slice(0, 32);
}

export function culpritFrom(stack?: StackFrame[]): string | null {
  const top = stack?.find((f) => f.inApp) ?? stack?.[0];
  return top ? `${top.file}:${top.line}` : null;
}

export function issueTitle(name: string, message?: string): string {
  const title = message ? `${name} — ${message}` : name;
  return title.length > 200 ? `${title.slice(0, 200)}…` : title;
}
