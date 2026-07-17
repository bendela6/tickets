import { describe, expect, it } from 'vitest';
import { worktreeName } from './worktree';

describe('worktreeName', () => {
  it('derives a filesystem-safe branch from an item ref + session id', () => {
    expect(worktreeName(42, 'TIX-153')).toBe('agent/tix-153-s42');
  });

  it('falls back to a generic name without an item ref', () => {
    expect(worktreeName(7)).toBe('agent/run-s7');
  });

  it('collapses non-alphanumerics in the ref', () => {
    expect(worktreeName(9, 'Feature/Foo Bar')).toBe('agent/feature-foo-bar-s9');
  });
});
