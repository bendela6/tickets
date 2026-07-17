import { describe, expect, it } from 'vitest';
import { worktreeName } from './worktree';

describe('worktreeName', () => {
  it('derives a filesystem-safe branch from a ticket ref + session id', () => {
    expect(worktreeName(42, 'TIX-153')).toBe('ai/tix-153-s42');
  });

  it('falls back to a generic name without a ticket ref', () => {
    expect(worktreeName(7)).toBe('ai/run-s7');
  });

  it('collapses non-alphanumerics in the ref', () => {
    expect(worktreeName(9, 'Feature/Foo Bar')).toBe('ai/feature-foo-bar-s9');
  });
});
