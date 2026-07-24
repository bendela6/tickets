import { describe, expect, it } from 'vitest';
import {
  signalKindIcon,
  signalKindTone,
  signalStatus,
  type SignalKind,
} from './signal-status';

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

describe('signalKindIcon', () => {
  it('maps all seven kinds to their registry icon', () => {
    expect(signalKindIcon('event')).toBe('diamond');
    expect(signalKindIcon('log')).toBe('rows');
    expect(signalKindIcon('click')).toBe('circle-dot');
    expect(signalKindIcon('navigation')).toBe('arrow-up-right');
    expect(signalKindIcon('http')).toBe('link');
    expect(signalKindIcon('error')).toBe('triangle-alert');
    expect(signalKindIcon('custom')).toBe('tag');
  });

  it('never collapses two kinds onto the same glyph', () => {
    const kinds: SignalKind[] = ['event', 'log', 'click', 'navigation', 'http', 'error', 'custom'];
    const icons = kinds.map(signalKindIcon);
    expect(new Set(icons).size).toBe(icons.length);
  });
});

describe('signalKindTone', () => {
  it('gives error the danger tone and event the primary/accent tone', () => {
    expect(signalKindTone('error')).toBe('danger');
    expect(signalKindTone('event')).toBe('primary');
  });

  it('keeps error visually distinct from a neutral kind like log', () => {
    const errorTone = signalKindTone('error');
    const eventTone = signalKindTone('event');
    const logTone = signalKindTone('log');
    expect(logTone).not.toBe(errorTone);
    expect(logTone).not.toBe(eventTone);
  });
});
