import { describe, expect, it } from 'vitest';
import { isCurrentPath } from './is-current-path';

describe('isCurrentPath', () => {
  it('matches the route itself and its descendants', () => {
    expect(isCurrentPath('/sites', '/sites')).toBe(true);
    expect(isCurrentPath('/sites', '/sites/zara.com/crawls')).toBe(true);
  });

  it('does not match a sibling that merely shares a prefix', () => {
    expect(isCurrentPath('/run', '/runs')).toBe(false);
  });

  it('matches the root only exactly', () => {
    expect(isCurrentPath('/', '/')).toBe(true);
    expect(isCurrentPath('/', '/sites')).toBe(false);
  });
});
