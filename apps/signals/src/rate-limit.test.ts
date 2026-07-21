import { expect, it } from 'vitest';
import { createRateLimiter } from './rate-limit';

it('allows up to the limit within a window, then refuses', () => {
  let t = 0;
  const rl = createRateLimiter({ limit: 3, windowMs: 1000, now: () => t });
  expect(rl.allow('k')).toBe(true);
  expect(rl.allow('k')).toBe(true);
  expect(rl.allow('k')).toBe(true);
  expect(rl.allow('k')).toBe(false);
  t = 1000; // new window
  expect(rl.allow('k')).toBe(true);
});

it('weights batches and isolates keys', () => {
  let t = 0;
  const rl = createRateLimiter({ limit: 10, windowMs: 1000, now: () => t });
  expect(rl.allow('a', 10)).toBe(true);
  expect(rl.allow('a', 1)).toBe(false);
  expect(rl.allow('b', 1)).toBe(true);
});
