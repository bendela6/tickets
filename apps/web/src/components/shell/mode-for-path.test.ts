import { describe, expect, it } from 'vitest';
import { modeForPath } from './mode-for-path';

describe('modeForPath', () => {
  it('maps task routes', () => {
    expect(modeForPath('/')).toBe('tasks');
    expect(modeForPath('/all')).toBe('tasks');
    expect(modeForPath('/p/APP')).toBe('tasks');
    expect(modeForPath('/p/APP/v/3')).toBe('tasks');
  });
  it('maps terminal and agent list routes', () => {
    expect(modeForPath('/terminals')).toBe('terminals');
    expect(modeForPath('/agents')).toBe('agents');
    expect(modeForPath('/agents/personas')).toBe('agents');
    expect(modeForPath('/agents/personas/5')).toBe('agents');
  });
  it('maps the split session viewer routes by path alone — no session lookup needed', () => {
    expect(modeForPath('/terminals/12')).toBe('terminals');
    expect(modeForPath('/agents/12')).toBe('agents');
  });
});
