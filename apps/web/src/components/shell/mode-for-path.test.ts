import { describe, expect, it } from 'vitest';
import { modeForPath } from './mode-for-path';

describe('modeForPath', () => {
  it('maps task routes', () => {
    expect(modeForPath('/')).toBe('tasks');
    expect(modeForPath('/all')).toBe('tasks');
    expect(modeForPath('/p/APP')).toBe('tasks');
    expect(modeForPath('/p/APP/v/3')).toBe('tasks');
  });
  it('maps signals routes by prefix', () => {
    expect(modeForPath('/signals')).toBe('signals');
    expect(modeForPath('/signals/apps')).toBe('signals');
    expect(modeForPath('/signals/sessions/x')).toBe('signals');
    expect(modeForPath('/signals/issues/3')).toBe('signals');
  });
  it('maps /schema to the schema mode', () => {
    expect(modeForPath('/schema')).toBe('schema');
  });

  it('maps a nested schema path to the schema mode', () => {
    expect(modeForPath('/schema/anything')).toBe('schema');
  });
});
