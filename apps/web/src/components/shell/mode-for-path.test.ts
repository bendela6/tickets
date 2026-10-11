import { describe, expect, it } from 'vitest';
import { modeForPath } from './mode-for-path';

describe('modeForPath', () => {
  it('maps task routes', () => {
    expect(modeForPath('/')).toBe('tasks');
    expect(modeForPath('/all')).toBe('tasks');
    expect(modeForPath('/p/APP')).toBe('tasks');
    expect(modeForPath('/p/APP/v/3')).toBe('tasks');
  });
  it('maps /schema to the schema mode', () => {
    expect(modeForPath('/schema')).toBe('schema');
  });

  it('maps a nested schema path to the schema mode', () => {
    expect(modeForPath('/schema/anything')).toBe('schema');
  });
});
