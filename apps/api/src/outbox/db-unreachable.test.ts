import { expect, it, vi } from 'vitest';
import { isDatabaseUnreachable } from './worker';

vi.mock('@bendela6/signals-node', () => ({ captureError: vi.fn(), captureEvent: vi.fn() }));

// The shape that actually reached the logs during a postgres outage: drizzle
// wraps the socket error, so the code only appears on `cause`.
function drizzleWrapped(code: string) {
  const cause = Object.assign(new Error(`connect ${code} 127.0.0.1:5532`), {
    code,
    errno: -4078,
    syscall: 'connect',
    address: '127.0.0.1',
    port: 5532,
  });
  return Object.assign(
    new Error('Failed query: select "id" from "core"."users" where "core"."users"."name" = $1'),
    { cause },
  );
}

it('recognizes a drizzle-wrapped ECONNREFUSED (the real outage shape)', () => {
  expect(isDatabaseUnreachable(drizzleWrapped('ECONNREFUSED'))).toBe(true);
});

it('recognizes the other socket failure modes', () => {
  for (const code of ['ECONNRESET', 'ENOTFOUND', 'EHOSTUNREACH', 'ETIMEDOUT', 'EPIPE']) {
    expect(isDatabaseUnreachable(drizzleWrapped(code)), code).toBe(true);
  }
});

it('recognizes a bare socket error with no wrapper', () => {
  expect(isDatabaseUnreachable(Object.assign(new Error('boom'), { code: 'ECONNREFUSED' }))).toBe(true);
});

it('does NOT swallow ordinary processing failures', () => {
  // These must keep logging/capturing — suppressing them would hide real bugs.
  expect(isDatabaseUnreachable(new Error('automation blew up'))).toBe(false);
  expect(isDatabaseUnreachable(Object.assign(new Error('bad input'), { code: '23505' }))).toBe(false);
  expect(isDatabaseUnreachable(undefined)).toBe(false);
  expect(isDatabaseUnreachable(null)).toBe(false);
  expect(isDatabaseUnreachable('a string')).toBe(false);
});

it('terminates on a self-referencing cause chain', () => {
  const err = new Error('loop') as Error & { cause?: unknown };
  err.cause = err;
  expect(isDatabaseUnreachable(err)).toBe(false);
});
