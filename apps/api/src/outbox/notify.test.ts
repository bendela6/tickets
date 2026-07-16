import { afterEach, expect, it, vi } from 'vitest';
import { clearOutboxNotify, notifyOutbox, onOutboxNotify } from './notify';

afterEach(clearOutboxNotify);

it('invokes the registered listener', () => {
  const spy = vi.fn();
  onOutboxNotify(spy);
  notifyOutbox();
  expect(spy).toHaveBeenCalledOnce();
});

it('is a no-op when no listener is registered', () => {
  expect(() => notifyOutbox()).not.toThrow();
});
