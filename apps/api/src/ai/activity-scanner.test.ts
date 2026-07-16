import { describe, expect, it } from 'vitest';
import { createActivityScanner } from './activity-scanner';

const C = (cmd = '') => `\x1b]133;C${cmd ? `;${cmd}` : ''}\x1b\\`;
const D = (code = '') => `\x1b]133;D${code !== '' ? `;${code}` : ''}\x1b\\`;

describe('activity-scanner', () => {
  it('passes plain output through untouched', () => {
    expect(createActivityScanner().push('hello')).toEqual({ clean: 'hello' });
  });
  it('C → busy true (+command), D → busy false (+exitCode), markers stripped', () => {
    const s = createActivityScanner();
    expect(s.push(`x${C('npm test')}y`)).toEqual({ clean: 'xy', event: { busy: true, command: 'npm test' } });
    expect(s.push(`a${D('1')}b`)).toEqual({ clean: 'ab', event: { busy: false, exitCode: 1 } });
  });
  it('bare C/D carry no command/exit', () => {
    const s = createActivityScanner();
    expect(s.push(C())).toEqual({ clean: '', event: { busy: true } });
    expect(s.push(D())).toEqual({ clean: '', event: { busy: false } });
  });
  it('A (prompt) → busy false', () => {
    expect(createActivityScanner().push('\x1b]133;A\x1b\\$ ')).toEqual({ clean: '$ ', event: { busy: false } });
  });
  it('detects a marker split across chunks', () => {
    const s = createActivityScanner();
    expect(s.push('out\x1b]133;C;np').clean).toBe('out'); // held back
    expect(s.push('m\x1b\\done')).toEqual({ clean: 'done', event: { busy: true, command: 'npm' } });
  });
});
