import { describe, expect, it } from 'vitest';
import { regressedPill, signalStatus } from './signal-status';

describe('signalStatus', () => {
  it('open is blue, half-filled', () => {
    const s = signalStatus('open');
    expect(s.tone).toBe('blue');
    expect(s.label).toBe('open');
  });
  it('resolved is green, checked', () => {
    const s = signalStatus('resolved');
    expect(s.tone).toBe('green');
    expect(s.label).toBe('resolved');
  });
  it('ignored is gray, dashed', () => {
    const s = signalStatus('ignored');
    expect(s.tone).toBe('gray');
    expect(s.label).toBe('ignored');
  });
});

describe('regressedPill', () => {
  it('is an orange chip with the regressed glyph', () => {
    expect(regressedPill.tone).toBe('orange');
    expect(regressedPill.label).toBe('↺ regressed');
  });
});
