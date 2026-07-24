import { describe, expect, it } from 'vitest';
import { statusPill } from './status';

describe('statusPill', () => {
  it('maps each kind to tone + shape-named icon', () => {
    expect(statusPill('todo')).toEqual({ tone: 'gray', icon: 'circle' });
    expect(statusPill('active')).toEqual({ tone: 'blue', icon: 'circle-half' });
    expect(statusPill('blocked')).toEqual({ tone: 'orange', icon: 'diamond' });
    expect(statusPill('done')).toEqual({ tone: 'green', icon: 'circle-check' });
    expect(statusPill('dropped')).toEqual({ tone: 'gray', icon: 'circle-dashed', strikethrough: true });
  });
});
