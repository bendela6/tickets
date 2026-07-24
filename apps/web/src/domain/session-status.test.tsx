import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { exitCodeTone, exitCodeTrailing, sessionStatus } from './session-status';

describe('sessionStatus', () => {
  it('running spins blue', () => {
    const s = sessionStatus('running');
    expect(s.tone).toBe('blue');
    expect(s.label).toBe('running');
  });
  it('awaiting_input is solid orange pulse', () => {
    const s = sessionStatus('awaiting_input');
    expect(s.tone).toBe('orange');
    expect(s.emphasis).toBe('solid');
    expect(s.className).toContain('animate-ai-pulse');
    expect(s.label).toBe('awaiting input');
  });
  it('terminal kind overrides labels', () => {
    expect(sessionStatus('starting', 'terminal').label).toBe('Connecting');
    expect(sessionStatus('failed', 'terminal').label).toBe("Couldn't start");
    expect(sessionStatus('live', 'terminal').label).toBe('Live');
  });
  it('exited is neutral square, failed is danger x, idle green ring', () => {
    expect(sessionStatus('exited').tone).toBe('secondary');
    expect(sessionStatus('failed').tone).toBe('danger');
    expect(sessionStatus('idle').tone).toBe('green');
  });
});

describe('exitCodeTone', () => {
  it('is success-colored for a clean exit and danger-colored otherwise', () => {
    expect(exitCodeTone(0)).toBe('text-opt-green');
    expect(exitCodeTone(1)).toBe('text-danger');
    expect(exitCodeTone(-1)).toBe('text-danger');
  });
});

describe('exitCodeTrailing', () => {
  it('clean exit (0) renders success-colored text', () => {
    render(<div>{exitCodeTrailing('exited', 0)}</div>);
    const el = screen.getByText('0');
    expect(el.className).toContain('text-opt-green');
  });
  it('non-zero exit code renders danger-colored text', () => {
    render(<div>{exitCodeTrailing('exited', 1)}</div>);
    const el = screen.getByText('1');
    expect(el.className).toContain('text-danger');
  });
  it('returns undefined for a non-exited status or a null code', () => {
    expect(exitCodeTrailing('running', 0)).toBeUndefined();
    expect(exitCodeTrailing('exited', null)).toBeUndefined();
    expect(exitCodeTrailing('exited', undefined)).toBeUndefined();
  });
});
