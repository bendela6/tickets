import { describe, expect, it } from 'vitest';
import { contextWindowFor, formatTokens } from './agent-models';

describe('contextWindowFor', () => {
  it('knows per-model windows', () => {
    expect(contextWindowFor('claude-opus-4-8')).toBe(1_000_000);
    expect(contextWindowFor('claude-sonnet-5')).toBe(200_000);
    expect(contextWindowFor('claude-haiku-4-5-20251001')).toBe(200_000);
  });
  it('falls back to 200k for unknown or missing models', () => {
    expect(contextWindowFor('mystery')).toBe(200_000);
    expect(contextWindowFor(null)).toBe(200_000);
    expect(contextWindowFor(undefined)).toBe(200_000);
  });
});

describe('formatTokens', () => {
  it('formats across magnitudes', () => {
    expect(formatTokens(0)).toBe('0');
    expect(formatTokens(948)).toBe('948');
    expect(formatTokens(72_000)).toBe('72k');
    expect(formatTokens(1_200_000)).toBe('1.2M');
  });
});
